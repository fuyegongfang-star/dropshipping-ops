/**
 * 4PX 递四方鉴权 / 接入配置（任务 3.4，方案 §1.1 / §3）。
 * 鉴权：MD5 签名（method+app_key+v+timestamp+format+param+secret，32 位小写，§1.1）。
 * 开放平台 router 入口（生产 open.4px.com/router，联调沙箱 open-test.4px.com/router）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

/** 4PX 生产 / 沙箱 router 入口（§1.1） */
export const FOURPX_BASE_URL = {
  prod: 'https://open.4px.com/router',
  sandbox: 'https://open-test.4px.com/router',
} as const

/** 4PX 默认抛比系数（§4.2） */
export const FOURPX_DEFAULT_VOLUMETRIC_DIVISOR = 5000

/** 默认请求超时（毫秒） */
export const FOURPX_REQUEST_TIMEOUT_MS = 10_000

/** 4PX API 版本（router 固定 v=1.0） */
export const FOURPX_API_VERSION = '1.0'

/** 4PX 鉴权配置（存于 CarrierAccount.credentials，§2.2/§17 加密落库） */
export interface FourPxAuthConfig {
  appKey: string // 4PX app_key
  appSecret: string // 4PX app_secret（MD5 签名密钥）
  sandbox?: boolean // 是否沙箱环境（默认 false = 生产）
  baseUrl?: string // 自定义基地址（覆盖默认，便于联调）
}
