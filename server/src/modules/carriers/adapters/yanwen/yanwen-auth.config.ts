/**
 * 燕文 Yanwen 鉴权 / 接入配置（任务 3.4，方案 §1.1 / §3）。
 * 鉴权：MD5 签名（apitoken+user_id+data+format+method+timestamp+version+apitoken，32 位小写，§1.1）。
 * 开放平台：生产 open.yw56.com.cn / 轨迹 track.yw56.com.cn（§1.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

/** 燕文生产基地址（§1.1） */
export const YANWEN_BASE_URL = {
  prod: 'https://open.yw56.com.cn',
  tracking: 'https://track.yw56.com.cn',
  sandbox: 'https://open.yw56.com.cn', // 燕文未明确沙箱域名，默认同生产（联调时校正）
} as const

/** 燕文 API 版本（固定 1.0） */
export const YANWEN_API_VERSION = '1.0'

/** 默认请求超时（毫秒） */
export const YANWEN_REQUEST_TIMEOUT_MS = 10_000

/** 燕文鉴权配置（存于 CarrierAccount.credentials，§2.2/§17 加密落库） */
export interface YanwenAuthConfig {
  userId: string // 燕文 user_id
  apiToken: string // 燕文 apiToken（MD5 签名密钥）
  sandbox?: boolean // 是否沙箱环境（默认 false = 生产）
  baseUrl?: string // 自定义基地址（覆盖默认，便于联调）
}
