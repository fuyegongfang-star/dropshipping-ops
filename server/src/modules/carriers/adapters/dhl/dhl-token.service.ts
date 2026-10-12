/**
 * DHL OAuth2 令牌服务（任务 3.3，方案 §1.1 / §2.2）。
 * 以 client_credentials 换取 accessToken：Basic 头（base64(clientId:clientSecret)）鉴权，
 * 按适配器实例维度进程内缓存，过期前自动刷新（§2.2）。
 * TODO(ops): 2026-11 接入 Redis 共享令牌缓存，多实例避免重复换取触发 DHL 限流（约 50/min，§1.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableResponse,
} from '../../../../common/http/retryable-http.service'
import {
  DHL_BASE_URL,
  DHL_ENDPOINTS,
  DHL_TOKEN_REFRESH_BUFFER_SEC,
  DhlAuthConfig,
} from './dhl-auth.config'

/** DHL OAuth 换取令牌响应（§1.1） */
interface DhlTokenResponse {
  access_token: string // 访问令牌
  token_type: string // 令牌类型（Bearer）
  expires_in: number // 有效期（秒）
}

/** 进程内令牌缓存条目 */
interface CachedToken {
  accessToken: string
  expiresAtMs: number
}

/**
 * DHL 令牌服务：构造期注入 http/logger/config；每个适配器实例独立缓存令牌。
 * 不依赖 DI（按租户账号按需构建，§2.2），故为普通类而非 @Injectable。
 */
export class DhlTokenService {
  private cache: CachedToken | null = null

  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
    private readonly config: DhlAuthConfig,
  ) {}

  /** 当前使用的基地址（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? DHL_BASE_URL.sandbox : DHL_BASE_URL.prod)
  }

  /** 取可用 accessToken：缓存有效则直返，否则重新换取（§2.2） */
  async getToken(): Promise<string> {
    const now = Date.now()
    const bufferMs = DHL_TOKEN_REFRESH_BUFFER_SEC * 1000
    if (this.cache && this.cache.expiresAtMs > now + bufferMs) {
      return this.cache.accessToken
    }
    return this.refresh()
  }

  /** 重新换取 accessToken（Basic 头鉴权）并写入缓存 */
  private async refresh(): Promise<string> {
    const url = `${this.baseUrl}${DHL_ENDPOINTS.token}`
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')
    const resp: RetryableResponse<DhlTokenResponse> = await this.http.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const data = resp.data
    if (!data || !data.access_token) {
      throw new Error(`[DHL] OAuth 换取令牌失败：响应缺 access_token，status=${resp.status}`)
    }
    this.cache = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000,
    }
    this.logger.debug(`[DHL] token 刷新成功，过期=${new Date(this.cache.expiresAtMs).toISOString()}`)
    return this.cache.accessToken
  }
}
