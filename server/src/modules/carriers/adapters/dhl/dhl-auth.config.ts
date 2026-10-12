/**
 * DHL Express（MyDHL API）鉴权 / 接入配置（任务 3.3，方案 §1.1 / §3）。
 * 鉴权：OAuth2（clientId+clientSecret → Basic 头换取 accessToken）+ 业务请求带 `DHL-API-Key`。
 * 生产需审批（2~5 工作日，且要沙箱真实运单证据）；沙箱 api-sandbox.dhl.com（§1.1）。
 * 限流约 50/min，建议 <40（§1.1）→ 令牌按实例缓存即可，避免重复换取触发限流。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

/** DHL 生产 / 沙箱 基地址（§1.1） */
export const DHL_BASE_URL = {
  prod: 'https://api.dhl.com',
  sandbox: 'https://api-sandbox.dhl.com',
} as const

/** DHL MyDHL API 路径（任务 3.3 拟定，字段命名以联调官网文档为准，§1.1） */
export const DHL_ENDPOINTS = {
  token: '/auth/v1/accesstoken', // OAuth2 client_credentials（Basic 头换取 accessToken）
  rates: '/v1/rates', // 运费+时效（Rating）
  shipments: '/v1/shipments', // 建单/运单/面单（Shipment）
  tracking: '/v1/shipments', // 轨迹：/v1/shipments/{id}/tracking（GET，轮询，§6）
} as const

/** DHL 默认抛比系数（体积重 = L*W*H / divisor，§4.2） */
export const DHL_DEFAULT_VOLUMETRIC_DIVISOR = 5000

/** 默认请求超时（毫秒）：覆盖 DHL 较慢调用（§1.1） */
export const DHL_REQUEST_TIMEOUT_MS = 10_000

/** OAuth token 提前刷新缓冲（秒）：DHL 令牌较短，留足余量（§2.2） */
export const DHL_TOKEN_REFRESH_BUFFER_SEC = 120

/** DHL 鉴权配置（存于 CarrierAccount.credentials，§2.2/§17 加密落库） */
export interface DhlAuthConfig {
  clientId: string // DHL OAuth clientId
  clientSecret: string // DHL OAuth clientSecret（Basic 头 base64(clientId:clientSecret)）
  apiKey: string // DHL-API-Key（业务请求头）
  accountNumber?: string // DHL 账号（比价/建单必填，§1.1）
  sandbox?: boolean // 是否沙箱环境（默认 false = 生产）
  baseUrl?: string // 自定义基地址（覆盖默认，便于联调）
}
