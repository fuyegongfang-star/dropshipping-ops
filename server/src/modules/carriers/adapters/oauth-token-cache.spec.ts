/**
 * OAuth 令牌共享缓存单测（任务 11.3 分布式缓存，方案 §10.3）。
 * 验证：云途 / DHL 令牌经 CacheService 在「多实例」间去重，避免重复换取触发承运商限流；
 * 未注入 CacheService 时回退实例内存（各自独立），行为兼容历史。
 *
 * 负责人：自动开发引擎 ｜ 2026-11-08
 */
import { AppLogger } from '../../../common/logger/app.logger'
import { CacheService } from '../../../common/cache'
import {
  RetryableHttpService,
  RetryableRequestOptions,
  RetryableResponse,
} from '../../../common/http/retryable-http.service'
import { YunExpressTokenService } from './yunexpress/yunexpress-token.service'
import { DhlTokenService } from './dhl/dhl-token.service'

/** 计数型假 HTTP：仅令牌端点返回 OAuth 报文，记录换取次数 */
function makeFakeHttp() {
  const state = { tokenCalls: 0 }
  const http = {
    async request<T>(url: string): Promise<RetryableResponse<T>> {
      if (url.includes('token') || url.includes('accesstoken')) {
        state.tokenCalls++
        return {
          status: 200,
          ok: true,
          data: { access_token: 'TK_shared', token_type: 'bearer', expires_in: 7200 } as unknown as T,
          rawText: '',
        }
      }
      return { status: 200, ok: true, data: null as unknown as T, rawText: '' }
    },
    requestJson<T>(url: string, _o?: RetryableRequestOptions): Promise<T> {
      return this.request(url).then((r) => r.data)
    },
  } as unknown as RetryableHttpService
  return { http, state }
}

const fakeLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
} as unknown as AppLogger

const yunConfig = {
  appId: 'app1',
  apiKey: 'key1',
  sandbox: true,
  baseUrl: 'https://yun.test',
} as any

const dhlConfig = {
  clientId: 'c1',
  clientSecret: 's1',
  apiKey: 'k1',
  sandbox: true,
  baseUrl: 'https://dhl.test',
} as any

describe('OAuth 令牌缓存（云途）', () => {
  it('未注入 CacheService：同实例命中缓存仅换 1 次；不同实例各自换取', async () => {
    const { http, state } = makeFakeHttp()
    const svcA = new YunExpressTokenService(http, fakeLogger, yunConfig)
    expect(await svcA.getToken()).toBe('TK_shared')
    expect(await svcA.getToken()).toBe('TK_shared') // 命中实例内存
    expect(state.tokenCalls).toBe(1)

    const { http: httpB, state: stateB } = makeFakeHttp()
    const svcB = new YunExpressTokenService(httpB, fakeLogger, yunConfig)
    expect(await svcB.getToken()).toBe('TK_shared') // 不同实例，无共享缓存
    expect(stateB.tokenCalls).toBe(1)
  })

  it('注入共享 CacheService：跨实例去重，仅换 1 次', async () => {
    const cache = new CacheService() // 内存后端作为「共享」模拟
    const { http: httpA, state: stateA } = makeFakeHttp()
    const svcA = new YunExpressTokenService(httpA, fakeLogger, yunConfig, cache)
    expect(await svcA.getToken()).toBe('TK_shared')

    // 新实例（独立 fakeHttp）共享同一 CacheService
    const { http: httpB, state: stateB } = makeFakeHttp()
    const svcB = new YunExpressTokenService(httpB, fakeLogger, yunConfig, cache)
    expect(await svcB.getToken()).toBe('TK_shared') // 命中共享缓存，不再联网
    expect(stateA.tokenCalls).toBe(1)
    expect(stateB.tokenCalls).toBe(0) // 关键：第二实例未触发换取
  })
})

describe('OAuth 令牌缓存（DHL）', () => {
  it('注入共享 CacheService：跨实例去重', async () => {
    const cache = new CacheService()
    const { http: httpA, state: stateA } = makeFakeHttp()
    const svcA = new DhlTokenService(httpA, fakeLogger, dhlConfig, cache)
    expect(await svcA.getToken()).toBe('TK_shared')

    const { http: httpB, state: stateB } = makeFakeHttp()
    const svcB = new DhlTokenService(httpB, fakeLogger, dhlConfig, cache)
    expect(await svcB.getToken()).toBe('TK_shared')
    expect(stateA.tokenCalls).toBe(1)
    expect(stateB.tokenCalls).toBe(0)
  })
})
