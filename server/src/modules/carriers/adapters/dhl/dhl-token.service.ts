/**
 * DHL OAuth2 令牌服务（任务 3.3，方案 §1.1 / §2.2）。
 * 以 client_credentials 换取 accessToken：Basic 头（base64(clientId:clientSecret)）鉴权，
 * 按「账号维度」共享缓存（任务 11.3 接入 CacheService），过期前自动刷新（§2.2）。
 * 多实例部署时经 Redis 共享令牌，避免重复换取触发 DHL 限流（约 50/min，§1.1）。
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

/** 令牌缓存条目（含绝对过期时间戳，便于跨实例共享时本地再校验） */
interface CachedToken {
  accessToken: string
  expiresAtMs: number
}

/**
 * DHL 令牌服务：构造期注入 http/logger/config；可按需注入共享 CacheService。
 * 不依赖 DI（按租户账号按需构建，§2.2），故为普通类而非 @Injectable。
 * 未注入 CacheService 时回退到实例内存缓存，行为与历史一致，保证既有调用方零改动。
 */
export class DhlTokenService {
  // 实例内存回退缓存（无共享缓存时使用）
  private mem: CachedToken | null = null

  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
    private readonly config: DhlAuthConfig,
    private readonly cache?: CacheService,
  ) {}

  /** 当前使用的基地址（自定义优先，否则按沙箱开关选择，§1.1） */
  private get baseUrl(): string {
    return this.config.baseUrl ?? (this.config.sandbox ? DHL_BASE_URL.sandbox : DHL_BASE_URL.prod)
  }

  /** 共享缓存键：按 clientId 区分账号，多实例共享同一令牌 */
  private cacheKey(): string {
    return `oauth:dhl:${this.config.clientId}`
  }

  /** 取可用 accessToken：缓存有效则直返，否则重新换取（§2.2） */
  async getToken(): Promise<string> {
    const now = Date.now()
    const bufferMs = DHL_TOKEN_REFRESH_BUFFER_SEC * 1000
    if (this.cache) {
      const hit = await this.cache.getJSON<CachedToken>(this.cacheKey())
      if (hit && hit.expiresAtMs > now + bufferMs) return hit.accessToken
    } else if (this.mem && this.mem.expiresAtMs > now + bufferMs) {
      return this.mem.accessToken
    }
    return this.refresh()
  }

  /** 重新换取 accessToken（Basic 头鉴权）并写入缓存（共享优先，回退实例内存） */
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
    const token: CachedToken = {
      accessToken: data.access_token,
      expiresAtMs: Date.now() + (data.expires_in || 3600) * 1000,
    }
    if (this.cache) {
      const ttlSec = Math.max(1, (data.expires_in || 3600) - DHL_TOKEN_REFRESH_BUFFER_SEC)
      await this.cache.setJSON(this.cacheKey(), token, ttlSec)
    } else {
      this.mem = token
    }
    this.logger.debug(`[DHL] token 刷新成功，过期=${new Date(token.expiresAtMs).toISOString()}`)
    return token.accessToken
  }
}
