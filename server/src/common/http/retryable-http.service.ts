/**
 * 可重试 HTTP 客户端（方案 §2.1 通用 HTTP 客户端层）。
 *
 * 职责：为所有外部平台调用（渠道 Shopify/Amazon、承运商 云途/DHL/4PX/燕文）
 *       提供统一的 超时 / 重试 / 指数退避 / 限流友好 能力，避免各适配器各自造轮子。
 *
 * 重试策略（与夜间自动化看门狗一致，§0/§31）：
 *   - 仅对「可重试」错误重试：HTTP 429（限流）或 5xx（服务端错误）或 网络抖动/超时/中止。
 *   - 指数退避：baseDelayMs × 2^attempt，默认 2000ms → 2s/4s/8s/16s/32s，最多 5 次。
 *   - 4xx（非 429）视为客户端错误，不重试，直接抛出。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

/** 单次请求默认超时（毫秒）：覆盖 DHL 等较慢调用（§1.1） */
export const DEFAULT_TIMEOUT_MS = 10_000
/** 默认最大重试次数（不含首次）：5 次 */
export const DEFAULT_MAX_RETRIES = 5
/** 退避基准（毫秒）：2s → 2/4/8/16/32s */
export const DEFAULT_BASE_DELAY_MS = 2_000

/** 标准化响应体 */
export interface RetryableResponse<T = unknown> {
  status: number // HTTP 状态码
  ok: boolean // 是否 2xx
  data: T // 解析后的 JSON；非 JSON 时回退为原始文本
  rawText: string // 原始响应文本（便于排障与对账，§3 JSONB 溯源）
}

/** 请求选项 */
export interface RetryableRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: unknown // 对象会被 JSON 序列化；字符串原样发送
  timeoutMs?: number // 单次超时，默认 DEFAULT_TIMEOUT_MS
  maxRetries?: number // 最大重试次数，默认 DEFAULT_MAX_RETRIES
  baseDelayMs?: number // 退避基准，默认 DEFAULT_BASE_DELAY_MS
}

/** HTTP 传输异常：携带状态码，便于判定是否可重试 */
export class HttpTransportException extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'HttpTransportException'
    this.status = status
  }
}

export class RetryableHttpService {
  private readonly logger = new AppLoggerShim()

  /**
   * 发起一次带重试的 HTTP 请求。
   * 见文件头「重试策略」：429/5xx/网络错误指数退避重试，4xx 直接抛出。
   */
  async request<T = unknown>(
    url: string,
    options: RetryableRequestOptions = {},
  ): Promise<RetryableResponse<T>> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS

    let lastError: unknown

    // 总尝试次数 = 1（首次）+ maxRetries（重试）
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const resp = await this.doFetch(url, options, timeoutMs)
        if (resp.ok) return resp as RetryableResponse<T>

        // 4xx（非 429）：客户端错误，不重试
        if (!this.isRetryableStatus(resp.status)) {
          throw new HttpTransportException(`HTTP ${resp.status}`, resp.status)
        }
        lastError = new HttpTransportException(`HTTP ${resp.status}`, resp.status)
        this.logRetry(attempt, maxRetries, url, resp.status)
      } catch (err) {
        // 网络/超时/中止 抛错 → 可重试；非 429 的 4xx 已在上层抛出 → 直接重抛
        if (err instanceof HttpTransportException && !this.isRetryableStatus(err.status)) {
          throw err
        }
        lastError = err
        const status = err instanceof HttpTransportException ? err.status : 0
        this.logRetry(attempt, maxRetries, url, status)
      }

      // 可重试失败：还有次数则退避后继续，否则退出循环抛出
      if (attempt < maxRetries) {
        await this.backoff(attempt, baseDelayMs)
      } else {
        break
      }
    }

    throw this.wrap(lastError)
  }

  /** 便捷方法：直接返回解析后的 JSON 数据 */
  async requestJson<T = unknown>(
    url: string,
    options: RetryableRequestOptions = {},
  ): Promise<T> {
    const resp = await this.request<T>(url, options)
    return resp.data
  }

  /** 执行单次请求（不重试），返回标准化响应；网络层错误向上抛出 */
  private async doFetch(
    url: string,
    options: RetryableRequestOptions,
    timeoutMs: number,
  ): Promise<RetryableResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const init: RequestInit = {
        method: options.method ?? 'GET',
        headers: options.headers,
        signal: controller.signal,
      }
      if (options.body !== undefined) {
        init.body =
          typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
        const h = (init.headers ??= {}) as Record<string, string>
        if (!h['Content-Type'] && !h['content-type']) {
          h['Content-Type'] = 'application/json'
        }
      }
      const res = await globalThis.fetch(url, init)
      const text = await res.text()
      const data = text ? this.safeParse(text) : null
      return { status: res.status, ok: res.ok, data, rawText: text }
    } finally {
      clearTimeout(timer)
    }
  }

  /** 判定状态是否可重试：429 限流 或 5xx 服务端错误 */
  private isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500
  }

  /** 指数退避：baseDelayMs × 2^attempt → 2s/4s/8s/16s/32s */
  private backoff(attempt: number, baseDelayMs: number): Promise<void> {
    const delay = baseDelayMs * 2 ** attempt
    return new Promise((resolve) => setTimeout(resolve, delay))
  }

  /** 解析 JSON，失败则保留原始文本 */
  private safeParse(text: string): unknown {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  private logRetry(attempt: number, maxRetries: number, url: string, status: number): void {
    this.logger.warn(
      `HTTP 可重试失败 url=${url} status=${status} attempt=${attempt + 1}/${maxRetries + 1}`,
    )
  }

  /** 末次失败包装：非 HttpTransportException 视为网络错误 */
  private wrap(lastError: unknown): HttpTransportException {
    if (lastError instanceof HttpTransportException) return lastError
    const msg = lastError instanceof Error ? lastError.message : String(lastError)
    return new HttpTransportException(`network error: ${msg}`, 0)
  }
}

/**
 * 轻量日志垫片：避免与 Nest DI 耦合，本服务可直接实例化使用。
 * 待全仓统一日志接入后（§24），可替换为 AppLogger。
 */
class AppLoggerShim {
  warn(message: string): void {
    // eslint-disable-next-line no-console
    console.warn(`[RetryableHttp] ${message}`)
  }
}
