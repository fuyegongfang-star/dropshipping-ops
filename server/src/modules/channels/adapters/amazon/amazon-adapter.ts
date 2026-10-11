/**
 * Amazon SP-API 渠道适配器（任务 1.10 评估，方案 §29）。
 *
 * 评估结论（阶段1）：
 *   - 认证闸门 LWA 已实现且可独立验证（见 AmazonLwaClient，无需 SigV4）。
 *   - 订单拉取 + 归一化已实现（Orders v0），框架适配（ChannelAdapter）已验证。
 *   - 真实 SP-API 读写端点需 AWS SigV4 签名：阶段1 以 NoopAmazonSigner 占位，
 *     生产接入需在阶段5 提供真实 SigV4 实现（AmazonSigner 接口），
 *     并依赖 AWS 凭证 + 开发者账号/应用审核（周期数天~数周，§29）。
 *   - FBA（AFN）由 Amazon 履约；FBM（MFN）自发货，需平台推单/上传运单。
 *
 * 本适配器落入 §3 ChannelAdapter 框架，与 Shopify 同构；完整对接在阶段5（任务 5.3）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { HttpStatus } from '@nestjs/common'
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
   * 回传/推单：需经 SigV4 + MerchantFulfillment/Shipping API（FBM 创建货件上传运单；FBA 由 Amazon 履约）。
   * 阶段1 评估：标记待阶段5 完整对接（§29）。
   */
  async pushFulfillment(_fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult> {
    throw new BusinessException(
      'AMAZON_FULFILLMENT_PENDING',
      'Amazon 推单/上传运单待阶段5 完整对接（SigV4 签名 + MerchantFulfillment/Shipping API）',
      HttpStatus.NOT_IMPLEMENTED,
    )
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

/**
 * Amazon 适配器工厂（按店铺凭证构建实例，§3 工厂型适配器）。
 * authConfig 解密后注入（§17）；缺失关键凭证时抛业务异常，优雅失败。
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
    return new AmazonAdapter(this.http, this.logger, cfg)
  }
}
