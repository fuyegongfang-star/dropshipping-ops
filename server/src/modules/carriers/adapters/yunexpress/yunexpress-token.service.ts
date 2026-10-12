/**
 * 云途 OAuth2 令牌服务（任务 3.2，方案 §1.1 / §2.2）。
 * 以 client_credentials 换取 accessToken，按适配器实例维度进程内缓存，过期前自动刷新（§2.2）。
 * TODO(ops): 2026-11 接入 Redis 共享令牌缓存（TokenCache 接口已预留），多实例避免重复换取触发云途限流。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableResponse,
} from '../../../../common/http/retryable-http.service'
import {
  YUNEXPRESS_BASE_URL,
  YUNEXPRESS_ENDPOINTS,
  YUNEXPRESS_TOKEN_REFRESH_BUFFER_SEC,
  YunExpressAuthConfig,
} from './yunexpress-auth.config'

/** 云途 OAuth 换取令牌响应（§1.1） */
interface YunExpressTokenResponse {
  access_token: string // 访问令牌
  token_type: string // 令牌类型（bearer）
  expires_in: number // 有效期（秒）
}

/** 进程内令牌缓存条目 */
interface CachedToken {
  accessToken: string // 缓存的 accessToken
  expiresAtMs: number // 绝对过期时间戳（毫秒）
}

/**
 * 云途令牌服务：构造期注入 http/logger/config；每个适配器实例独立缓存令牌。
 * 不依赖 DI（按租户账号按需构建，§2.2），故为普通类而非 @Injectable。
 */
export class YunExpressTokenService {
  private cache: CachedToken | null = null

  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
    private readonly config: YunExpressAuthConfig,
  ) {}

  /** 当前使用的基地址（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? YUNEXPRESS_BASE_URL.sandbox : YUNEXPRESS_BASE_URL.prod)
  }

  /** 取可用 accessToken：缓存有效则直返，否则重新换取（§2.2） */
  async getToken(): Promise<string> {
    const now = Date.now()
    const bufferMs = YUNEXPRESS_TOKEN_REFRESH_BUFFER_SEC * 1000
    if (this.cache && this.cache.expiresAtMs > now + bufferMs) {
      return this.cache.accessToken
    }
    return this.refresh()
  }

  /** 重新换取 accessToken 并写入缓存 */
  private async refresh(): Promise<string> {
    const url = `${this.baseUrl}${YUNEXPRESS_ENDPOINTS.token}`
    // OAuth2 client_credentials：表单格式（§1.1）
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.appId,
      client_secret: this.config.apiKey,
    }).toString()
    const resp: RetryableResponse<YunExpressTokenResponse> = await this.http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = resp.data
    if (!data || !data.access_token || !data.expires_in) {
      throw new Error(
        `[YunExpress] OAuth 换取令牌失败：响应缺 access_token/expires_in，status=${resp.status}`,
      )
    }
    this.cache = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + data.expires_in * 1000,
    }
    this.logger.debug(
      `[YunExpress] token 刷新成功，过期=${new Date(this.cache.expiresAtMs).toISOString()}`,
    )
    return this.cache.accessToken
  }
}
