/**
 * 开放平台前端接口（任务 5.2，方案 §28 开放 API 与生态集成）。
 * 类型与标签对齐后端 openapi.types.ts；对接 http.ts（演示/正式双路）。
 */
import http from './http'

/** 开放接口作用域 */
export type OpenScope = 'orders' | 'quotes' | 'tracking' | 'bills' | 'erp'
/** 开放客户端（OAuth2 client_credentials 应用） */
export interface ApiClient {
  id: string
  tenantId: string
  name: string
  clientId: string
  clientSecret?: string
  scopes: OpenScope[]
  rateLimitPerMin: number
  status: 'enabled' | 'disabled'
  createdAt: string
  updatedAt: string
}
/** Webhook 订阅 */
export interface WebhookSubscription {
  id: string
  tenantId: string
  event: string
  url: string
  status: 'active' | 'paused'
  createdAt: string
}
/** 开放平台总览 */
export interface OpenApiSummary {
  clientCount: number
  webhookCount: number
  rateLimitTotal: number
  endpointCount: number
}
/** 创建客户端入参 */
export interface CreateApiClientDto {
  name: string
  scopes: OpenScope[]
  rateLimitPerMin?: number
}
/** 新建 Webhook 入参 */
export interface CreateWebhookDto {
  event: string
  url: string
}

// ===== 标签 =====
export const OPEN_SCOPE_LABELS: Record<OpenScope, string> = {
  orders: '订单查询',
  quotes: '运费试算',
  tracking: '轨迹查询',
  bills: '账单查询',
  erp: 'ERP 凭证',
}

export const OPEN_SCOPE_TAG: Record<OpenScope, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
  orders: 'primary',
  quotes: 'success',
  tracking: 'warning',
  bills: 'info',
  erp: 'danger',
}

/** 开放接口文档条目（静态说明，供前端「接口文档」页展示） */
export const OPEN_ENDPOINTS: {
  method: 'POST' | 'GET'
  path: string
  scope: OpenScope
  description: string
}[] = [
  { method: 'POST', path: '/openapi/oauth/token', scope: 'erp', description: 'OAuth2 client_credentials 换取 Bearer 令牌' },
  { method: 'GET', path: '/openapi/me', scope: 'orders', description: '当前令牌对应的客户端画像（脱敏）' },
  { method: 'GET', path: '/openapi/orders', scope: 'orders', description: '查询本租户订单列表' },
  { method: 'POST', path: '/openapi/quotes', scope: 'quotes', description: '运费试算（查价）' },
  { method: 'GET', path: '/openapi/bills', scope: 'bills', description: '查询本租户账单（应收/应付）' },
  { method: 'GET', path: '/openapi/erp/gl', scope: 'erp', description: '生成 ERP 财务凭证分录（应收应付）' },
  { method: 'GET', path: '/openapi/webhooks', scope: 'orders', description: '查询 Webhook 订阅' },
  { method: 'POST', path: '/openapi/webhooks', scope: 'orders', description: '新建 Webhook 订阅' },
]

/** 开放平台接口封装（演示/正式双路，统一经 http.ts） */
export const openApiApi = {
  /** 开放平台总览（四卡） */
  summary: () => http.get<OpenApiSummary>('/openapi/summary'),
  /** 客户端列表 */
  listClients: () => http.get<ApiClient[]>('/openapi/clients'),
  /** 创建客户端 */
  createClient: (dto: CreateApiClientDto) => http.post<ApiClient>('/openapi/clients', dto),
  /** 删除客户端 */
  deleteClient: (id: string) => http.delete<{ deleted: boolean }>(`/openapi/clients/${id}`),
  /** 轮换客户端密钥 */
  rotateSecret: (id: string) => http.post<ApiClient>(`/openapi/clients/${id}/rotate`),
  /** Webhook 订阅列表 */
  listWebhooks: () => http.get<WebhookSubscription[]>('/openapi/webhooks'),
  /** 新建 Webhook 订阅 */
  createWebhook: (dto: CreateWebhookDto) => http.post<WebhookSubscription>('/openapi/webhooks', dto),
}

export default openApiApi
