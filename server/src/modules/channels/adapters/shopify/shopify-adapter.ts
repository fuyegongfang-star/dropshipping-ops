/**
 * Shopify 渠道适配器（任务 1.2，方案 §3 首渠道 / §0 全渠道）。
 * 基于 Shopify Admin REST API 实现拉单 / 回传（推单）/ 查单 / 撤单 / 轨迹，
 * 复用 AbstractChannelAdapter 与 RetryableHttpService（超时/重试/指数退避，§2.1）。
 *
 * 凭证：从 Shop.authConfig 注入（shopDomain + Admin API accessToken，§17 加密存储）。
 * 入站 Webhook 验签（订单/轨迹推送）属独立端点，不在适配器内（§3/§17）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable, HttpStatus } from '@nestjs/common'
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

/** Shopify API 版本（集中常量，避免散落 magic string，§31） */
export const SHOPIFY_API_VERSION = '2024-01'

/** Shopify 授权凭证（落 Shop.authConfig，运行时解密注入，§17） */
export interface ShopifyCredentials {
  shopDomain: string // 店铺域名（如 my-store.myshopify.com，不含协议）
  accessToken: string // Admin API 访问令牌（X-Shopify-Access-Token）
}

/** Shopify 地址结构（部分字段） */
interface ShopifyAddress {
  first_name?: string
  last_name?: string
  phone?: string
  address1?: string
  address2?: string
  city?: string
  province?: string
  zip?: string
  country_code?: string
}

/** Shopify 订单行项 */
interface ShopifyLineItem {
  sku?: string
  title?: string
  quantity?: number
  price?: string // 字符串金额（Shopify 返回字符串）
}

/** Shopify 订单结构（部分字段） */
interface ShopifyOrder {
  id: number // 数字 ID，作为平台订单号
  order_number?: number
  financial_status?: string // paid | pending | refunded | voided ...
  fulfillment_status?: string | null // fulfilled | partial | null
  created_at?: string
  currency?: string
  total_price?: string
  shipping_address?: ShopifyAddress
  line_items?: ShopifyLineItem[]
}

/** Shopify 订单列表响应 */
interface ShopifyOrderList {
  orders: ShopifyOrder[]
}

export class ShopifyAdapter extends AbstractChannelAdapter {
  private readonly shopDomain: string
  private readonly accessToken: string

  constructor(
    http: RetryableHttpService,
    logger: AppLogger,
    credentials: ShopifyCredentials,
  ) {
    super(ChannelPlatform.SHOPIFY, http, logger)
    this.shopDomain = credentials.shopDomain
    this.accessToken = credentials.accessToken
  }

  /** 鉴权头：Shopify Admin API 使用专用访问令牌头 */
  private authHeaders(): Record<string, string> {
    return {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json',
    }
  }

  /** API 基址 */
  private baseUrl(): string {
    const domain = this.shopDomain.replace(/^https?:\/\//, '')
    return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}`
  }

  /** 拉单：拉取 open 订单并归一化（§3 拉单） */
  async pullOrders(options: ChannelPullOptions): Promise<PulledChannelOrderResult[]> {
    const params = new URLSearchParams({ status: 'open' })
    if (options.since) params.set('created_at_min', options.since)
    if (options.cursor) params.set('since_id', options.cursor)
    if (options.limit) params.set('limit', String(options.limit))

    const url = `${this.baseUrl()}/orders.json?${params.toString()}`
    const resp = await this.requestJson<ShopifyOrderList>(url, {
      method: 'GET',
      headers: this.authHeaders(),
    })
    return (resp.orders ?? []).map((order) => ({
      order: this.mapOrder(order),
      raw: order, // 落 Order.raw（JSONB 溯源，§3）
    }))
  }

  /** 拉单确认：Shopify 无显式确认接口，使用增量游标（since_id）避免重复拉取（幂等，§9.4） */
  async acknowledgeOrders(_orderNos: string[]): Promise<void> {
    this.logger.debug(`[Shopify] acknowledge skipped (cursor-based dedupe)`, 'Shopify')
  }

  /** 回传/推单：创建履约并写入运单号（§3 推单回传） */
  async pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult> {
    const orderId = fulfillment.platformOrderNo // 即 Shopify 订单 ID
    const body = {
      fulfillment: {
        tracking_number: fulfillment.trackingNo,
        tracking_company: fulfillment.carrierName ?? 'Custom',
        line_items: (fulfillment.lineItems ?? []).map((li) => ({
          sku: li.platformSku,
          quantity: Number(li.quantity),
        })),
      },
    }
    const url = `${this.baseUrl()}/orders/${orderId}/fulfillments.json`
    try {
      const resp = await this.requestJson<{ fulfillment: { id: number; status: string } }>(url, {
        method: 'POST',
        headers: this.authHeaders(),
        body,
      })
      return {
        platformOrderNo: fulfillment.platformOrderNo,
        success: true,
        trackingNo: fulfillment.trackingNo,
        message: resp.fulfillment?.status,
      }
    } catch (err) {
      return {
        platformOrderNo: fulfillment.platformOrderNo,
        success: false,
        message: (err as Error).message,
      }
    }
  }

  /** 查单：返回平台订单状态 */
  async fetchOrderStatus(platformOrderNo: string): Promise<ChannelOrderStatus> {
    const url = `${this.baseUrl()}/orders/${platformOrderNo}.json`
    const resp = await this.requestJson<{ order: ShopifyOrder }>(url, {
      method: 'GET',
      headers: this.authHeaders(),
    })
    return this.mapStatus(resp.order)
  }

  /** 撤单：调用 Shopify 取消接口（逆向流程入口，§13.2） */
  async cancelOrder(platformOrderNo: string): Promise<void> {
    const url = `${this.baseUrl()}/orders/${platformOrderNo}/cancel.json`
    await this.requestJson(url, { method: 'POST', headers: this.authHeaders() })
  }

  /** 轨迹：查询履约记录并归一化（§3 轨迹） */
  async getTracking(platformOrderNo: string): Promise<ChannelTrackingResult> {
    const url = `${this.baseUrl()}/orders/${platformOrderNo}/fulfillments.json`
    const resp = await this.requestJson<{ fulfillments: Array<{ tracking_number?: string; status?: string; created_at?: string }> }>(
      url,
      { method: 'GET', headers: this.authHeaders() },
    )
    const fulfillment = resp.fulfillments?.[0]
    return {
      platformOrderNo,
      trackingNo: fulfillment?.tracking_number,
      status: ChannelOrderStatus.PAID, // Shopify 轨迹归一化：以履约状态为主，详细节点见 raw
      events: (resp.fulfillments ?? []).map((f) => ({
        status: f.status ?? 'unknown',
        occurredAt: f.created_at ?? new Date().toISOString(),
        description: `fulfillment ${f.tracking_number ?? ''}`.trim(),
      })),
    }
  }

  /** 健康检查：探测 Shopify 连通性（打店铺接口） */
  async healthCheck(): Promise<ChannelHealth> {
    const start = Date.now()
    try {
      await this.requestJson<{ shop: { id: number } }>(`${this.baseUrl()}/shop.json`, {
        method: 'GET',
        headers: this.authHeaders(),
        maxRetries: 1,
      })
      return { healthy: true, latencyMs: Date.now() - start, message: 'shopify reachable' }
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, message: (err as Error).message }
    }
  }

  /** 归一化 Shopify 订单 → 内部 DTO */
  private mapOrder(order: ShopifyOrder): PulledChannelOrderDto {
    const addr = order.shipping_address
    return {
      platformOrderNo: String(order.id),
      status: this.mapStatus(order),
      items: (order.line_items ?? []).map((li) => ({
        platformSku: li.sku ?? '',
        skuCode: li.sku ?? `SHOPIFY-${li.sku ?? li.title ?? 'UNKNOWN'}`,
        title: li.title ?? '未知商品',
        quantity: li.quantity ?? 1,
        price: li.price != null ? Number(li.price) : undefined,
      })),
      recipient: {
        name: [addr?.first_name, addr?.last_name].filter(Boolean).join(' ') || '未知',
        phone: addr?.phone,
        country: addr?.country_code ?? '',
        state: addr?.province,
        city: addr?.city ?? '',
        address1: addr?.address1 ?? '',
        address2: addr?.address2,
        zip: addr?.zip,
      },
      currency: order.currency,
      totalAmount: order.total_price != null ? Number(order.total_price) : undefined,
      placedAt: order.created_at,
    }
  }

  /** 映射 Shopify 状态 → 归一化状态 */
  private mapStatus(order: ShopifyOrder): ChannelOrderStatus {
    if (order.financial_status === 'voided' || order.financial_status === 'refunded') {
      return ChannelOrderStatus.CANCELLED
    }
    if (order.fulfillment_status === 'fulfilled') return ChannelOrderStatus.FULFILLED
    if (order.financial_status === 'paid') return ChannelOrderStatus.PAID
    return ChannelOrderStatus.CREATED
  }
}

/**
 * Shopify 适配器工厂（按店铺凭证构建实例）。
 * authConfig 解密后注入（§17）；缺失凭证时抛业务异常，优雅失败。
 */
@Injectable()
export class ShopifyAdapterFactory {
  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
  ) {}

  build(shop: ShopCredentialContext): ShopifyAdapter {
    const cfg = (shop.authConfig ?? {}) as ShopifyCredentials
    if (!cfg.shopDomain || !cfg.accessToken) {
      throw new BusinessException(
        'SHOPIFY_CREDENTIALS_MISSING',
        'Shopify 凭证缺失（shopDomain/accessToken）',
        HttpStatus.BAD_REQUEST,
      )
    }
    return new ShopifyAdapter(this.http, this.logger, cfg)
  }
}
