import { CacheBackend } from './cache-backend.interface'

/** 单条缓存条目：值 + 绝对过期时间戳(ms)，expiresAt=null 表示永不过期 */
interface MemoryEntry {
  value: string
  expiresAt: number | null
}

/**
 * 进程内缓存后端（默认后端，任务 11.3 方案 §10.3）。
 *
 * 纯内存 Map + TTL 惰性过期，零依赖、零网络，单实例 / 开发 / 沙箱 / 单元测试均可用。
 * 局限：多实例部署时各实例缓存独立，令牌 / FX 无法共享 —— 生产应切换 Redis 后端（见 CacheService）。
 */
export class MemoryCacheBackend implements CacheBackend {
  private readonly store = new Map<string, MemoryEntry>()

  /** 惰性过期：读取 / 存在性判断时顺带清除过期条目，避免内存泄漏 */
  private live(key: string): MemoryEntry | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null
  }

  async set(key: string, value: string, ttlSec = 0): Promise<void> {
    // ttlSec<=0 视为不过期，避免把 0 误当 1 秒
    const expiresAt = ttlSec > 0 ? Date.now() + ttlSec * 1000 : null
    this.store.set(key, { value, expiresAt })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async exists(key: string): Promise<boolean> {
    return this.live(key) !== null
  }
}
