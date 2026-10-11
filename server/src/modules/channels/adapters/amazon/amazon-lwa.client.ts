/**
 * Amazon LWA（Login with Amazon）OAuth2 客户端（方案 §29 认证）。
 * SP-API 用 LWA 颁发的 access token 作为 `x-amz-access-token` 头；
 * 真实 SP-API 读写端点还需 AWS SigV4 签名（阶段5 完成，见 AmazonAdapter/AmazonSigner）。
 *
 * 本客户端独立可测：仅 LWA token 端点使用普通 TLS（无需 SigV4），是阶段1 评估可先行落地的认证闸门。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableRequestOptions,
} from '../../../../common/http/retryable-http.service'

/** LWA 北美 token 端点；欧洲 eu-west-1 / 远东 us-west-2 用各自区域端点（§29） */
export const LWA_TOKEN_ENDPOINT = 'https://api.amazon.com/auth/o2/token'

/** LWA 颁发的令牌 */
export interface LwaToken {
  access_token: string
  token_type: string
  expires_in: number // 秒
  refresh_token?: string
  scope?: string
}

/** LWA 凭证（来自 Shop.authConfig，§17 加密存储） */
export interface LwaCredentials {
  clientId: string
  clientSecret: string
  refreshToken?: string // 卖家授权流（拉单需此）；应用级 client_credentials 可空
}

/** 内存令牌缓存项 */
interface CachedToken {
  token: string
  expiresAt: number // 绝对过期毫秒
}

/**
 * LWA OAuth2 客户端：支持 client_credentials（应用级）与 refresh_token（卖家授权）两种 grant，
 * 内置令牌缓存（提前 60s 续期），复用 RetryableHttpService 的超时/重试/退避（§2.1）。
 */
export class AmazonLwaClient {
  private cached: CachedToken | null = null

  constructor(
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
    private readonly endpoint: string = LWA_TOKEN_ENDPOINT,
  ) {}

  /** 取（缓存的）LWA access token；失效前复用，避免频繁请求（§29 限流友好） */
  async getAccessToken(creds: LwaCredentials): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) {
      return this.cached.token
    }
    const token = await this.fetchToken(creds)
    this.cached = {
      token: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    }
    this.logger.debug(`[LWA] token 已获取，有效期 ${token.expires_in}s`, 'Amazon')
    return token.access_token
  }

  /** 向 LWA token 端点申请令牌（grant_type 按是否带 refreshToken 区分） */
  private async fetchToken(creds: LwaCredentials): Promise<LwaToken> {
    const params = new URLSearchParams()
    params.set('client_id', creds.clientId)
    params.set('client_secret', creds.clientSecret)
    if (creds.refreshToken) {
      params.set('grant_type', 'refresh_token')
      params.set('refresh_token', creds.refreshToken)
    } else {
      params.set('grant_type', 'client_credentials')
    }
    const options: RetryableRequestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
    return this.http.requestJson<LwaToken>(this.endpoint, options)
  }
}
