import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 开放平台类型与 DTO（任务 5.2，方案 §28 开放 API 与生态集成）。
 *
 * 开放 API 面向商户的 ERP / 自建系统：以 OAuth2 client_credentials 颁发令牌，
 * 商户凭令牌调用「下单/查价/查轨迹/查账单/ERP 财务凭证」等开放接口；平台侧提供
 * 客户端管理、Webhook 订阅与限流。当前为内存实现（演示口径 + 单测可跑），
 * TODO(platform): 2026-11 接入 Prisma `ApiClient / WebhookSubscription` 模型持久化，
 * 并把开放资源对接真实 OrdersService / BillingService / PricingEngineService。
 */

/** OAuth2 授权类型（开放平台仅支持客户端凭证模式） */
export type GrantType = 'client_credentials'

/** 开放接口作用域（对应可被调用的资源分组） */
export type OpenScope = 'orders' | 'quotes' | 'tracking' | 'bills' | 'erp'

/** 开放客户端（OAuth2 client_credentials 应用）。 */
export interface ApiClient {
  id: string
  tenantId: string
  /** 展示名（商户可见） */
  name: string
  /** 客户端标识，令牌颁发与鉴权使用 */
  clientId: string
  /** 客户端密钥（明文仅演示；TODO(platform): 走 SecretEncryptionService 加密存储） */
  clientSecret: string
  /** 授权作用域（决定可调用的开放接口） */
  scopes: OpenScope[]
  /** 限流：每分钟最大请求数 */
  rateLimitPerMin: number
  /** 状态：enabled 可调用 / disabled 停用 */
  status: 'enabled' | 'disabled'
  createdAt: string
  updatedAt: string
}

/** 令牌响应（OAuth2 标准字段） */
export interface OAuthTokenResponse {
  access_token: string
  token_type: 'Bearer'
  /** 有效期（秒） */
  expires_in: number
}

/** 令牌解析后的开放客户端上下文（注入到请求，供资源接口读取） */
export interface OpenApiClientContext {
  clientId: string
  tenantId: string
  scopes: OpenScope[]
}

/** Webhook 订阅（商户订阅平台事件，平台异步回调其 URL）。 */
export interface WebhookSubscription {
  id: string
  tenantId: string
  /** 订阅事件：order.shipped 等 */
  event: string
  /** 回调地址（商户接收端点） */
  url: string
  /** 订阅状态 */
  status: 'active' | 'paused'
  createdAt: string
}

/** 开放资源：商户订单（脱敏后的可对外视图） */
export interface OpenOrder {
  orderId: string
  platformOrderNo: string
  recipientName: string
  country: string
  amount: number
  currency: string
  status: string
  createdAt: string
}

/** 开放资源：报价试算结果（查价） */
export interface OpenQuote {
  carrierCode: string
  productCode: string
  weightKg: number
  cost: number
  sellPrice: number
  currency: string
  etaDays: number
}

/** 开放资源：账单（查账单，平台级聚合到租户） */
export interface OpenBill {
  period: string
  type: 'receivable' | 'payable'
  amount: number
  currency: string
  status: string
}

/** 开放资源：ERP 财务凭证分录（自动生成应收应付，§28 ERP 集成） */
export interface GlVoucherEntry {
  /** 凭证行摘要 */
  summary: string
  /** 科目编码（参考金蝶/用友通用编码） */
  accountCode: string
  /** 科目名称 */
  accountName: string
  /** 借贷方向 */
  direction: 'debit' | 'credit'
  amount: number
  currency: string
}

/** 创建开放客户端入参（super 平台运营可创建） */
export class CreateApiClientDto {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsArray()
  @IsEnum(['orders', 'quotes', 'tracking', 'bills', 'erp'], { each: true })
  scopes!: OpenScope[]

  @IsOptional()
  rateLimitPerMin?: number
}

/** 新建 Webhook 订阅入参 */
export class CreateWebhookDto {
  @IsString()
  @MaxLength(60)
  event!: string

  @IsString()
  @MaxLength(300)
  url!: string
}

/** 客户端凭证换取令牌入参 */
export class TokenRequestDto {
  @IsEnum(['client_credentials'])
  grant_type!: GrantType

  @IsString()
  client_id!: string

  @IsString()
  client_secret!: string
}

/** 开放平台总览（前端四卡） */
export interface OpenApiSummary {
  /** 客户端数 */
  clientCount: number
  /** Webhook 订阅数 */
  webhookCount: number
  /** 限流总配额（各客户端每分钟之和） */
  rateLimitTotal: number
  /** 开放接口数量 */
  endpointCount: number
}
