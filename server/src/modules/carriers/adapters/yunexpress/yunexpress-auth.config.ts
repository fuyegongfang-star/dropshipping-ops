/**
 * 云途 YunExpress 鉴权 / 接入配置（任务 3.2，方案 §1.1 / §3）。
 * 云途开放平台：OAuth2（appId+apiKey → 换取并缓存 accessToken）+ HMAC-SHA256 请求签名。
 * 生产基地址 https://openapi.yunexpress.cn ；沙箱 https://openapi-sbx.yunexpress.cn （§1.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

/** 云途生产 / 沙箱 开放平台基地址（§1.1） */
export const YUNEXPRESS_BASE_URL = {
  prod: 'https://openapi.yunexpress.cn',
  sandbox: 'https://openapi-sbx.yunexpress.cn',
} as const

/**
 * 云途开放平台 API 路径（任务 3.2 拟定，字段命名以联调时官网文档为准，§1.1）。
 * 路径集中管理，便于一处校正（联调阶段仅改此处）。
 */
export const YUNEXPRESS_ENDPOINTS = {
  token: '/oauth/token', // OAuth2 client_credentials 换取 accessToken
  pricing: '/api/pricing/trial', // 运费试算 / 比价（pricing trial，§4）
  create: '/api/waybill/create', // 建单 / 推单（createShipment）
  print: '/api/waybill/print', // 面单打印（getLabel）
  tracking: '/api/tracking/query', // 轨迹查询（getTracking）
  cancel: '/api/waybill/cancel', // 取消运单（cancelShipment）
  subscribe: '/api/tracking/subscribe', // 轨迹订阅推送（subscribeTracking，§6 双通道）
} as const

/** 云途默认抛比系数（体积重 = L*W*H / divisor，§4.2；专线常见 5000/6000） */
export const YUNEXPRESS_DEFAULT_VOLUMETRIC_DIVISOR = 5000

/** 默认请求超时（毫秒）：覆盖云途较慢调用（§1.1） */
export const YUNEXPRESS_REQUEST_TIMEOUT_MS = 10_000

/** OAuth token 提前刷新缓冲（秒）：避免边界过期导致请求 401（§2.2） */
export const YUNEXPRESS_TOKEN_REFRESH_BUFFER_SEC = 60

/** 云途鉴权配置（存于 CarrierAccount.credentials，§2.2/§17 加密落库） */
export interface YunExpressAuthConfig {
  appId: string // 开放平台 AppId（OAuth client_id）
  apiKey: string // 开放平台 ApiKey（OAuth client_secret，亦作 HMAC 签名密钥）
  sandbox?: boolean // 是否沙箱环境（默认 false = 生产）
  baseUrl?: string // 自定义基地址（覆盖默认，便于联调 / 私有化部署）
}
