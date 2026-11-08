/**
 * 云途 OAuth2 令牌服务（任务 3.2，方案 §1.1 / §2.2）。
 * 以 client_credentials 换取 accessToken，按「账号维度」共享缓存（任务 11.3 接入 CacheService），
 * 过期前自动刷新（§2.2）。多实例部署时经 Redis 共享令牌，避免重复换取触发云途限流。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-11-08（11.3 分布式缓存）
 */

import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableResponse,
} from '../../../../common/http/retryable-http.service'
import { CacheService } from '../../../../common/cache'
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

/** 令牌缓存条目（含绝对过期时间戳，便于跨实例共享时本地再校验） */
interface CachedToken {
  accessToken: string // 缓存的 accessToken
  expiresAtMs: number // 绝对过期时间戳（毫秒）
}

/**
 * 云途令牌服务：构造期注入 http/logger/config；可按需注入共享 CacheService。
 * 不依赖 DI（按租户账号按需构建，§2.2），故为普通类而非 @Injectable。
 * 未注入 CacheService 时回退到实例内存缓存，行为与历史一致，保证既有调用方零改动。
 */
export class YunExpressTokenService {
  // 实例内存回退缓存（无共享缓存时使用）
  private mem: CachedToken | null = null

  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
    private readonly config: YunExpressAuthConfig,
    private readonly cache?: CacheService,
  ) {}

  /** 当前使用的基地址（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? YUNEXPRESS_BASE_URL.sandbox : YUNEXPRESS_BASE_URL.prod)
  }

  /** 共享缓存键：按 appId 区分账号，多实例共享同一令牌 */
  private cacheKey(): string {
    return `oauth:yunexpress:${this.config.appId}`
  }

  /** 取可用 accessToken：缓存有效则直返，否则重新换取（§2.2） */
  async getToken(): Promise<string> {
    const now = Date.now()
    const bufferMs = YUNEXPRESS_TOKEN_REFRESH_BUFFER_SEC * 1000
    // 优先共享缓存（多实例去重，避免重复换取触发限流）
    if (this.cache) {
      const hit = await this.cache.getJSON<CachedToken>(this.cacheKey())
      if (hit && hit.expiresAtMs > now + bufferMs) return hit.accessToken
    } else if (this.mem && this.mem.expiresAtMs > now + bufferMs) {
      return this.mem.accessToken
    }
    return this.refresh()
  }

  /** 重新换取 accessToken 并写入缓存（共享优先，回退实例内存） */
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
    const token: CachedToken = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + data.expires_in * 1000,
    }
    // 写入共享缓存：TTL = 有效期 - 刷新缓冲，提前过期促使刷新
    if (this.cache) {
      const ttlSec = Math.max(1, data.expires_in - YUNEXPRESS_TOKEN_REFRESH_BUFFER_SEC)
      await this.cache.setJSON(this.cacheKey(), token, ttlSec)
    } else {
      this.mem = token
    }
    this.logger.debug(
      `[YunExpress] token 刷新成功，过期=${new Date(token.expiresAtMs).toISOString()}`,
    )
    return token.accessToken
  }
}
