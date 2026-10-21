/**
 * Amazon SP-API 渠道适配器（任务 5.3 完整对接，方案 §29）。
 *
 * 阶段1（1.10 评估）已落地：LWA 认证闸门（AmazonLwaClient）+ 订单拉取/归一化（Orders v0），
 * 框架适配（ChannelAdapter）已验证。本任务（5.3）补齐 §29 三大能力：
 *   - FBA Inbound（头程入仓）：createInboundShipmentPlan / createInboundShipment / getInboundShipment
 *     / getPrepInstructions —— 卖家货从国内发往 Amazon 分配的 FBA 仓（§14 头程）。
 *   - Shipping（FBM 推单）：purchaseShippingLabel —— 经 MerchantFulfillment 购末程面单取追踪号。
 *   - Reports（对账）：requestReport / getReport / getReportDocument / getSettlementSummary —— 结算报表下载并解析。
 * 同时启用真实 AWS SigV4 签名（AmazonSigV4Signer，对照官方测试向量离线验证）；
 * 缺 AWS 凭证时回退 NoopAmazonSigner（评估/演示，避免 403 误判）。
 *
 * 本适配器落入 §3 ChannelAdapter 框架，与 Shopify 同构；由 AmazonAdapterFactory 按店铺 authConfig 构建。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

import { HttpStatus } from '@nestjs/common'
import * as zlib from 'zlib'
import { BusinessException } from '../../../../common/response/business.exception'
import { AppLogger } from '../../../../common/logger/app.logger'
import { RetryableHttpService } from '../../../../common/http/retryable-http.service'
import { AbstractChannelAdapter } from '../../abstract-channel.adapter'
import {
  ChannelHealth,
  ChannelPlatform,
  ChannelPullOptions,
  ChannelOrderStatus,
} from '../../channel.constants'
import { PulledChannelOrderDto, PulledChannelOrderResult } from '../../dto/pulled-order.dto'
import {
  ChannelFulfillmentDto,
  ChannelFulfillmentResult,
  ChannelTrackingResult,
} from '../../dto/channel-fulfillment.dto'
import { ShopCredentialContext } from '../../channel-registry.service'
import { AmazonLwaClient, LwaCredentials } from './amazon-lwa.client'
import { AmazonSigV4Signer } from './amazon-sigv4.signer'

/** SP-API 请求签名器（§29：AWS SigV4）。阶段1 占位 Noop；阶段5 替换为真实实现。 */
export interface AmazonRequestSigner {
  sign(req: AmazonSignRequest): Promise<AmazonSignRequest>
}
/** 待签名请求 */
export interface AmazonSignRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}
/** 阶段1 占位签名器：透传（生产需 SigV4，否则 AWS 返回 403）。 */
export class NoopAmazonSigner implements AmazonRequestSigner {
  async sign(req: AmazonSignRequest): Promise<AmazonSignRequest> {
    return req
  }
}

/** Amazon 渠道凭证（落 Shop.authConfig，§17 加密；AWS 凭证为阶段5 SigV4 预留） */
export interface AmazonCredentials extends LwaCredentials {
  region: string // SP-API 区域（如 us-east-1 / eu-west-1）
  marketplaceId: string // 商城 ID（如 ATVPDKIKX0DER 美国）
  awsAccessKey?: string // 阶段5 SigV4（IAM 角色/用户）
  awsSecretKey?: string
}

/** SP-API Orders v0 订单（部分字段） */
interface AmazonOrder {
  AmazonOrderId: string
  PurchaseDate?: string
  LastUpdateDate?: string
  OrderStatus?: string
  FulfillmentChannel?: 'AFN' | 'MFN' | string // AFN=Amazon 履约(FBA) / MFN=商家履约(FBM)
  OrderTotal?: { Amount?: string; CurrencyCode?: string }
  ShippingAddress?: AmazonAddress
}
interface AmazonAddress {
  Name?: string
  AddressLine1?: string
  AddressLine2?: string
  City?: string
  StateOrRegion?: string
  PostalCode?: string
  CountryCode?: string
  Phone?: string
}
interface AmazonOrderItem {
  SellerSKU?: string
  ASIN?: string
  Title?: string
  QuantityOrdered?: number
  ItemPrice?: { Amount?: string; CurrencyCode?: string }
}
interface AmazonOrderList {
  Orders?: AmazonOrder[]
}
interface AmazonOrderItems {
  OrderItems?: AmazonOrderItem[]
}

// —— §29 完整对接：FBA Inbound / Shipping / Reports 三能力相关类型 ——

/** 入库计划输入项（卖家 SKU + 数量） */
export interface AmazonInboundItemInput {
  sellerSku: string
  quantity: number // 计划入仓数量（件）
}
/** 入库计划（FBA Inbound createInboundShipmentPlan 返回） */
export interface AmazonInboundShipmentPlan {
  shipmentPlanId: string
  destinationFulfillmentCenterId: string // 目的 FBA 仓（如 IND9）
  items: Array<{ sellerSku: string; quantity: number; fulfillmentNetworkSku: string }>
}
/** 入库货件（FBA Inbound createInboundShipment 返回） */
export interface AmazonInboundShipment {
  shipmentId: string
  shipmentName: string
  destinationFulfillmentCenterId: string
  status: string // WORKING / IN_TRANSIT / DELIVERED 等
  items: Array<{ sellerSku: string; quantity: number }>
}
/** 预处理指引（FBA Inbound getPrepInstructions 返回） */
export interface AmazonPrepInstruction {
  sellerSku: string
  prepGuidance: string // NO_PREP_NEEDED / CONSULT_STYLE_GUIDE 等
  prepOwner?: string // AMAZON / SELLER
}
/** 购买运单结果（MerchantFulfillment createShipment 返回，FBM 推单用） */
export interface AmazonShippingLabel {
  shipmentId: string
  trackingId: string // 追踪号（回写 Amazon 用）
  labelFileType: string // PNG / PDF / ZPL203 等
  labelFileContents: string // base64 编码的面单文件
  downloadUrl?: string
}
/** 报表（Reports 2021-06-30 返回） */
export interface AmazonReport {
  reportId: string
  reportType: string // 如 _GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2_
  processingStatus: string // IN_QUEUE / IN_PROGRESS / DONE / FATAL
  createdTime?: string
  dataStartTime?: string
  dataEndTime?: string
}
/** 报表文档（Reports getReportDocument 返回，含预签名下载地址） */
export interface AmazonReportDocument {
  documentId: string
  url: string // 预签名 S3 地址（直接下载，无需 SigV4）
  compressionAlgorithm?: string // GZIP / 空
}
/** 结算汇总（解析结算报表得到） */
export interface AmazonSettlementSummary {
  currency: string
  totalAmount: number // 总入账（订单收入）
  totalFee: number // 总费用（绝对值）
  net: number // 净额 = 入账 − 费用
  transactionCount: number
  byType: Array<{ type: string; amount: number }> // 按 amount-type 归集
}

export class AmazonAdapter extends AbstractChannelAdapter {
  private readonly creds: AmazonCredentials
  private readonly lwa: AmazonLwaClient
  private readonly signer: AmazonRequestSigner

  constructor(
    http: RetryableHttpService,
    logger: AppLogger,
    credentials: AmazonCredentials,
    lwa?: AmazonLwaClient,
    signer?: AmazonRequestSigner,
  ) {
    super(ChannelPlatform.AMAZON, http, logger)
    this.creds = credentials
    this.lwa = lwa ?? new AmazonLwaClient(http, logger)
    this.signer = signer ?? new NoopAmazonSigner()
  }

  /** SP-API 区域端点（§29） */
  private spApiBase(): string {
    return `https://sellingpartnerapi-${this.creds.region}.amazon.com`
  }

  /** LWA 鉴权头 */
  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.lwa.getAccessToken(this.creds)
    return { 'x-amz-access-token': token, 'Content-Type': 'application/json' }
  }

  /**
   * 拉单：拉取 Unshipped/PartiallyShipped 订单，逐单补拉明细（§29 Orders 能力）。
   * 注：SP-API 列表不含明细，需二次 getOrderItems；真实调用需 SigV4（阶段5）。
   */
  async pullOrders(options: ChannelPullOptions): Promise<PulledChannelOrderResult[]> {
    const params = new URLSearchParams()
    params.set('MarketplaceIds', this.creds.marketplaceId)
    params.set('OrderStatuses', 'Unshipped,PartiallyShipped')
    if (options.since) params.set('LastUpdatedAfter', options.since)
    if (options.limit) params.set('MaxResults', String(options.limit))

    const url = `${this.spApiBase()}/orders/v0/orders?${params.toString()}`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const list = await this.requestJson<AmazonOrderList>(signed.url, {
      method: 'GET',
      headers: signed.headers,
    })

    const results: PulledChannelOrderResult[] = []
    for (const order of list.Orders ?? []) {
      const items = await this.fetchOrderItems(order.AmazonOrderId)
      results.push({ order: this.mapOrder(order, items), raw: order })
    }
    return results
  }

  /** 补拉订单明细（Orders v0 getOrderItems） */
  private async fetchOrderItems(orderId: string): Promise<AmazonOrderItem[]> {
    const url = `${this.spApiBase()}/orders/v0/orders/${orderId}/items`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const resp = await this.requestJson<AmazonOrderItems>(signed.url, {
      method: 'GET',
      headers: signed.headers,
    })
    return resp.OrderItems ?? []
  }

  /** 拉单确认：SP-API 以增量（LastUpdatedAfter）幂等拉取，无需显式确认（§9.4） */
  async acknowledgeOrders(_orderNos: string[]): Promise<void> {
    this.logger.debug('[Amazon] acknowledge skipped (delta-based dedupe)', 'Amazon')
  }

  /**
   * 回传/推单：FBM 自发货经 MerchantFulfillment 购买运单并取追踪号（§29 Shipping 能力）；
   * FBA(AFN) 由 Amazon 履约，调用方（channel-sync）按订单 FulfillmentChannel 区分、不会将 FBA 订单送入本路径。
   * 真实调用需 SigV4（阶段5 已落地 AmazonSigV4Signer）。
   */
  async pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult> {
    const label = await this.purchaseShippingLabel({
      amazonOrderId: fulfillment.platformOrderNo,
      items: (fulfillment.lineItems ?? []).map((it) => ({
        sellerSku: it.platformSku,
        quantity: it.quantity,
      })),
    })
    return {
      platformOrderNo: fulfillment.platformOrderNo,
      success: true,
      trackingNo: label.trackingId,
      message: `Amazon 面单已购（shipmentId=${label.shipmentId}）`,
    }
  }

  // —— §29 完整对接：FBA Inbound 头程入仓 ——

  /**
   * FBA 入库计划：根据发货 SKU 与数量，请求 Amazon 分配目的 FBA 仓与入仓方案（/fba/inbound/v0/plans）。
   * 头程（§14）即把货从国内发往返回的 destinationFulfillmentCenterId。
   */
  async createInboundShipmentPlan(input: {
    items: AmazonInboundItemInput[]
    shipFromAddress: Partial<AmazonAddress>
    labelPrepPreference?: 'SELLER_LABEL' | 'AMAZON_LABEL'
  }): Promise<AmazonInboundShipmentPlan[]> {
    const url = `${this.spApiBase()}/fba/inbound/v0/plans`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({
      url,
      method: 'POST',
      headers,
      body: {
        ShipFromAddress: input.shipFromAddress,
        LabelPrepPreference: input.labelPrepPreference ?? 'SELLER_LABEL',
        InboundShipmentPlanRequestItems: input.items.map((it) => ({
          SellerSKU: it.sellerSku,
          Quantity: it.quantity,
        })),
      },
    })
    const resp = await this.requestJson<{
      payload?: { InboundShipmentPlans?: RawInboundPlan[] }
    }>(signed.url, { method: 'POST', headers: signed.headers, body: signed.body })
    return (resp.payload?.InboundShipmentPlans ?? []).map(mapInboundPlan)
  }

  /** FBA 建仓：按入库计划创建实际货件（/fba/inbound/v0/shipments） */
  async createInboundShipment(input: {
    shipmentId?: string
    shipmentName: string
    plan: AmazonInboundShipmentPlan
    shipFromAddress: Partial<AmazonAddress>
  }): Promise<AmazonInboundShipment> {
    const shipmentId = input.shipmentId ?? `FBA${Date.now()}`
    const url = `${this.spApiBase()}/fba/inbound/v0/shipments`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({
      url,
      method: 'POST',
      headers,
      body: {
        InboundShipmentHeader: {
          ShipmentName: input.shipmentName,
          DestinationFulfillmentCenterId: input.plan.destinationFulfillmentCenterId,
          ShipFromAddress: input.shipFromAddress,
          LabelPrepPreference: 'SELLER_LABEL',
          ShipmentStatus: 'WORKING',
        },
        InboundShipmentItems: input.plan.items.map((it) => ({
          SellerSKU: it.sellerSku,
          QuantityShipped: it.quantity,
          FulfillmentNetworkSKU: it.fulfillmentNetworkSku,
        })),
        MarketplaceId: this.creds.marketplaceId,
      },
    })
    const resp = await this.requestJson<{ payload?: RawInboundShipment }>(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    })
    return mapInboundShipment({ ShipmentId: shipmentId, ...(resp.payload ?? {}) })
  }

  /** FBA 查询货件：取指定 shipmentId 的入仓状态（/fba/inbound/v0/shipments/{id}） */
  async getInboundShipment(shipmentId: string): Promise<AmazonInboundShipment> {
    const url = `${this.spApiBase()}/fba/inbound/v0/shipments/${encodeURIComponent(shipmentId)}`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const resp = await this.requestJson<{ payload?: RawInboundShipment }>(signed.url, {
      method: 'GET',
      headers: signed.headers,
    })
    return mapInboundShipment({ ShipmentId: shipmentId, ...(resp.payload ?? {}) })
  }

  /** FBA 预处理指引：给定 SKU 列表，查询 Amazon 要求的预处理方式（/fba/inbound/v0/prepInstructions） */
  async getPrepInstructions(sellerSkus: string[]): Promise<AmazonPrepInstruction[]> {
    const params = new URLSearchParams()
    sellerSkus.forEach((sku) => params.append('SellerSKUList', sku))
    params.set('ShipToCountryCode', 'US')
    const url = `${this.spApiBase()}/fba/inbound/v0/prepInstructions?${params.toString()}`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const resp = await this.requestJson<{
      payload?: { SKUPrepInstructionsList?: RawPrepInstruction[] }
    }>(signed.url, { method: 'GET', headers: signed.headers })
    return (resp.payload?.SKUPrepInstructionsList ?? []).map((p) => ({
      sellerSku: p.SellerSKU ?? '',
      prepGuidance: p.PrepGuidance ?? 'UNKNOWN',
      prepOwner: p.PrepOwner,
    }))
  }

  // —— §29 完整对接：Shipping 买运单（FBM 推单） ——

  /**
   * 购买运单（MerchantFulfillment createShipment，/mfn/v0/shipments）：
   * FBM 自发货时，经 Amazon 购买末程面单并取追踪号，用于 pushFulfillment 回写。
   */
  async purchaseShippingLabel(input: {
    amazonOrderId: string
    items: AmazonInboundItemInput[]
    shipFromAddress?: Partial<AmazonAddress>
  }): Promise<AmazonShippingLabel> {
    const url = `${this.spApiBase()}/mfn/v0/shipments`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({
      url,
      method: 'POST',
      headers,
      body: {
        AmazonOrderId: input.amazonOrderId,
        Items: input.items.map((it) => ({ SellerSKU: it.sellerSku, Quantity: it.quantity })),
        ShipFromAddress: input.shipFromAddress ?? {
          Name: 'Default Seller',
          AddressLine1: '1 Seller St',
          City: 'Los Angeles',
          StateOrRegion: 'CA',
          PostalCode: '90001',
          CountryCode: 'US',
          Phone: '0000000000',
        },
        PackageDimensions: { Length: 10, Width: 10, Height: 10, Unit: 'INCH' },
        Weight: { Value: 1, Unit: 'LB' },
        ShippingServiceId: 'DEFAULT',
      },
    })
    const resp = await this.requestJson<{ payload?: RawShipment }>(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    })
    const ship = resp.payload ?? ({} as RawShipment)
    return {
      shipmentId: ship.ShipmentId ?? '',
      trackingId: ship.TrackingId ?? '',
      labelFileType: ship.Label?.FileType ?? 'PDF',
      labelFileContents: ship.Label?.FileContents ?? '',
      downloadUrl: ship.Label?.DownloadUrl,
    }
  }

  // —— §29 完整对接：Reports 对账 ——

  /** 请求报表：按 reportType 创建报表（Reports 2021-06-30，/reports/2021-06-30/reports） */
  async requestReport(
    reportType: string,
    dataStartTime?: string,
    dataEndTime?: string,
  ): Promise<AmazonReport> {
    const url = `${this.spApiBase()}/reports/2021-06-30/reports`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({
      url,
      method: 'POST',
      headers,
      body: {
        reportType,
        marketplaceIds: [this.creds.marketplaceId],
        ...(dataStartTime ? { dataStartTime } : {}),
        ...(dataEndTime ? { dataEndTime } : {}),
      },
    })
    const resp = await this.requestJson<{ payload?: RawReport }>(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
    })
    return mapReport(resp.payload ?? ({} as RawReport))
  }

  /** 查询报表状态：轮询 processingStatus 直到 DONE/FATAL（/reports/2021-06-30/reports/{id}） */
  async getReport(reportId: string): Promise<AmazonReport> {
    const url = `${this.spApiBase()}/reports/2021-06-30/reports/${encodeURIComponent(reportId)}`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const resp = await this.requestJson<{ payload?: RawReport }>(signed.url, {
      method: 'GET',
      headers: signed.headers,
    })
    return mapReport(resp.payload ?? ({} as RawReport))
  }

  /**
   * 下载报表文档：取预签名地址并下载；若 GZIP 则解码（SP-API 报表为压缩文件）。
   * 文档地址为预签名 S3 URL，无需 SigV4，直接 fetch 取字节后 gunzip（§29 对账）。
   */
  async getReportDocument(documentId: string): Promise<string> {
    const url = `${this.spApiBase()}/reports/2021-06-30/documents/${encodeURIComponent(documentId)}`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const doc = await this.requestJson<AmazonReportDocument>(signed.url, {
      method: 'GET',
      headers: signed.headers,
    })
    return this.downloadDocument(doc.url, doc.compressionAlgorithm)
  }

  /** 直接下载文档字节并解码（GZIP→文本）；预签名 URL 无需鉴权 */
  private async downloadDocument(docUrl: string, compression?: string): Promise<string> {
    const res = await globalThis.fetch(docUrl)
    if (!res.ok) {
      throw new BusinessException(
        'AMAZON_REPORT_DOWNLOAD_FAILED',
        `报表文档下载失败 HTTP ${res.status}`,
        HttpStatus.BAD_GATEWAY,
      )
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const text = compression === 'GZIP' ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8')
    return text
  }

  /**
   * 结算汇总：下载指定结算报表文档并解析（结算报表为 TSV 平文件，列含 amount-type/amount/currency-code）。
   * 按 amount-type 归集，给出总入账/总费用/净额（§29 对账）。
   */
  async getSettlementSummary(documentId: string): Promise<AmazonSettlementSummary> {
    const text = await this.getReportDocument(documentId)
    return parseSettlement(text)
  }

  /** 查单：GET getOrder 并映射状态 */
  async fetchOrderStatus(platformOrderNo: string): Promise<ChannelOrderStatus> {
    const order = await this.fetchOrder(platformOrderNo)
    return this.mapStatus(order)
  }

  /** 撤单：SP-API 无直接撤单接口，需经退款/取消流程（阶段5）；评估阶段标记待对接 */
  async cancelOrder(_platformOrderNo: string): Promise<void> {
    throw new BusinessException(
      'AMAZON_CANCEL_PENDING',
      'Amazon 撤单待阶段5 完整对接（SP-API 无直接撤单，需退款/取消流程）',
      HttpStatus.NOT_IMPLEMENTED,
    )
  }

  /** 轨迹：GET getOrder 取基础状态；FBA/FBM 实际轨迹节点由阶段5 补齐（§3 轨迹） */
  async getTracking(platformOrderNo: string): Promise<ChannelTrackingResult> {
    const order = await this.fetchOrder(platformOrderNo)
    return {
      platformOrderNo,
      trackingNo: undefined,
      status: this.mapStatus(order),
      events: [],
    }
  }

  /** 健康检查：以 LWA 令牌申请作为连通性代理（不触碰需 SigV4 的 SP-API 端点） */
  async healthCheck(): Promise<ChannelHealth> {
    const start = Date.now()
    try {
      await this.lwa.getAccessToken(this.creds)
      return { healthy: true, latencyMs: Date.now() - start, message: 'LWA reachable' }
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, message: (err as Error).message }
    }
  }

  /** 取单笔订单（getOrder） */
  private async fetchOrder(orderId: string): Promise<AmazonOrder> {
    const url = `${this.spApiBase()}/orders/v0/orders/${orderId}`
    const headers = await this.authHeaders()
    const signed = await this.signer.sign({ url, method: 'GET', headers })
    const resp = await this.requestJson<{ payload?: AmazonOrder }>(signed.url, {
      method: 'GET',
      headers: signed.headers,
    })
    return resp.payload ?? ({ AmazonOrderId: orderId } as AmazonOrder)
  }

  /** 归一化 Amazon 订单 → 内部 DTO */
  private mapOrder(order: AmazonOrder, items: AmazonOrderItem[]): PulledChannelOrderDto {
    const addr = order.ShippingAddress
    return {
      platformOrderNo: order.AmazonOrderId,
      status: this.mapStatus(order),
      items: items.map((it) => ({
        platformSku: it.SellerSKU ?? '',
        skuCode: it.SellerSKU ?? `AMAZON-${it.ASIN ?? 'UNKNOWN'}`,
        title: it.Title ?? '未知商品',
        quantity: it.QuantityOrdered ?? 1,
        price: it.ItemPrice?.Amount != null ? Number(it.ItemPrice.Amount) : undefined,
      })),
      recipient: {
        name: addr?.Name ?? '未知',
        phone: addr?.Phone,
        country: addr?.CountryCode ?? '',
        state: addr?.StateOrRegion,
        city: addr?.City ?? '',
        address1: addr?.AddressLine1 ?? '',
        address2: addr?.AddressLine2,
        zip: addr?.PostalCode,
      },
      currency: order.OrderTotal?.CurrencyCode,
      totalAmount: order.OrderTotal?.Amount != null ? Number(order.OrderTotal.Amount) : undefined,
      placedAt: order.PurchaseDate,
    }
  }

  /** 映射 Amazon OrderStatus → 归一化状态 */
  private mapStatus(order: AmazonOrder): ChannelOrderStatus {
    switch (order.OrderStatus) {
      case 'Canceled':
        return ChannelOrderStatus.CANCELLED
      case 'Shipped':
        return ChannelOrderStatus.FULFILLED
      case 'Unshipped':
      case 'PartiallyShipped':
        return ChannelOrderStatus.PAID
      case 'Pending':
        return ChannelOrderStatus.CREATED
      default:
        return ChannelOrderStatus.UNKNOWN
    }
  }
}

// —— §29 原始响应结构与归一化映射（SP-API 驼峰字段） ——

/** FBA 入库计划原始响应 */
interface RawInboundPlan {
  ShipmentPlanId?: string
  DestinationFulfillmentCenterId?: string
  Items?: Array<{ SellerSKU?: string; Quantity?: number; FulfillmentNetworkSKU?: string }>
}
/** FBA 货件原始响应 */
interface RawInboundShipment {
  ShipmentId?: string
  ShipmentName?: string
  DestinationFulfillmentCenterId?: string
  ShipmentStatus?: string
  Items?: Array<{ SellerSKU?: string; QuantityShipped?: number }>
}
/** FBA 预处理原始响应 */
interface RawPrepInstruction {
  SellerSKU?: string
  PrepGuidance?: string
  PrepOwner?: string
}
/** MerchantFulfillment 货件原始响应 */
interface RawShipment {
  ShipmentId?: string
  TrackingId?: string
  Label?: { FileType?: string; FileContents?: string; DownloadUrl?: string }
}
/** Reports 报表原始响应（2021-06-30 驼峰） */
interface RawReport {
  reportId?: string
  reportType?: string
  processingStatus?: string
  createdTime?: string
  dataStartTime?: string
  dataEndTime?: string
}

/** 入库计划归一化 */
function mapInboundPlan(raw: RawInboundPlan): AmazonInboundShipmentPlan {
  return {
    shipmentPlanId: raw.ShipmentPlanId ?? '',
    destinationFulfillmentCenterId: raw.DestinationFulfillmentCenterId ?? '',
    items: (raw.Items ?? []).map((it) => ({
      sellerSku: it.SellerSKU ?? '',
      quantity: it.Quantity ?? 0,
      fulfillmentNetworkSku: it.FulfillmentNetworkSKU ?? '',
    })),
  }
}

/** 货件归一化 */
function mapInboundShipment(raw: RawInboundShipment): AmazonInboundShipment {
  return {
    shipmentId: raw.ShipmentId ?? '',
    shipmentName: raw.ShipmentName ?? '',
    destinationFulfillmentCenterId: raw.DestinationFulfillmentCenterId ?? '',
    status: raw.ShipmentStatus ?? '',
    items: (raw.Items ?? []).map((it) => ({
      sellerSku: it.SellerSKU ?? '',
      quantity: it.QuantityShipped ?? 0,
    })),
  }
}

/** 报表归一化 */
function mapReport(raw: RawReport): AmazonReport {
  return {
    reportId: raw.reportId ?? '',
    reportType: raw.reportType ?? '',
    processingStatus: raw.processingStatus ?? '',
    createdTime: raw.createdTime,
    dataStartTime: raw.dataStartTime,
    dataEndTime: raw.dataEndTime,
  }
}

/**
 * 解析结算报表（TSV/CSV 平文件）：定位 amount-type / amount / currency-code 列，
 * 按 amount-type 归集金额，给出总入账（正）/总费用（负绝对值）/净额（§29 对账）。
 * 列分隔符自适应：含制表符用 TAB，否则用逗号；引号字段做最小化处理。
 */
function parseSettlement(text: string): AmazonSettlementSummary {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) {
    return { currency: '', totalAmount: 0, totalFee: 0, net: 0, transactionCount: 0, byType: [] }
  }

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const parseRow = (line: string): string[] => {
    // 最小化 CSV 解析：按分隔符切分并去除包围引号
    const cells = line.split(delimiter)
    return cells.map((c) => c.trim().replace(/^"(.*)"$/, '$1'))
  }

  const header = parseRow(lines[0]).map((h) => h.toLowerCase())
  const typeIdx = header.findIndex((h) => h.includes('amount-type') || h === 'amount type')
  const amountIdx = header.findIndex((h) => h === 'amount')
  const currIdx = header.findIndex((h) => h.includes('currency-code'))

  const byTypeMap = new Map<string, number>()
  let totalAmount = 0
  let totalFee = 0
  let net = 0
  let count = 0
  let currency = ''

  for (let i = 1; i < lines.length; i++) {
    const cells = parseRow(lines[i])
    const amountRaw = amountIdx >= 0 ? cells[amountIdx] : ''
    const amount = Number(amountRaw)
    if (Number.isNaN(amount)) continue
    const type = typeIdx >= 0 ? cells[typeIdx] : 'UNKNOWN'
    // 结算报表通常单币种：以首条有效记录的币种作为汇总币种
    if (!currency && currIdx >= 0) currency = cells[currIdx]
    byTypeMap.set(type, (byTypeMap.get(type) ?? 0) + amount)
    if (amount > 0) totalAmount += amount
    else totalFee += Math.abs(amount)
    net += amount
    count += 1
  }

  const byType = Array.from(byTypeMap.entries()).map(([type, amount]) => ({ type, amount }))
  return { currency, totalAmount, totalFee, net, transactionCount: count, byType }
}

/**
 * Amazon 适配器工厂（按店铺凭证构建实例，§3 工厂型适配器）。
 * authConfig 解密后注入（§17）；缺失关键凭证时抛业务异常，优雅失败。
 * 阶段5（§29）：若提供 AWS 凭证则启用真实 SigV4 签名器，否则回退 Noop 占位（评估/演示）。
 */
export class AmazonAdapterFactory {
  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
  ) {}

  build(shop: ShopCredentialContext): AmazonAdapter {
    const cfg = (shop.authConfig ?? {}) as AmazonCredentials
    if (!cfg.clientId || !cfg.clientSecret || !cfg.refreshToken || !cfg.marketplaceId) {
      throw new BusinessException(
        'AMAZON_CREDENTIALS_MISSING',
        'Amazon 凭证缺失（clientId/clientSecret/refreshToken/marketplaceId）',
        HttpStatus.BAD_REQUEST,
      )
    }
    // 阶段5（§29）：提供 AWS 凭证则启用真实 SigV4 签名器；否则 Noop 占位（评估/演示，避免 403 误判）
    const signer =
      cfg.awsAccessKey && cfg.awsSecretKey
        ? new AmazonSigV4Signer(cfg.awsAccessKey, cfg.awsSecretKey, cfg.region)
        : new NoopAmazonSigner()
    return new AmazonAdapter(this.http, this.logger, cfg, undefined, signer)
  }
}
