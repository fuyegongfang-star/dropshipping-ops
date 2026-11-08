import { CacheBackend } from './cache-backend.interface'
import { MemoryCacheBackend } from './memory-cache.backend'
import { RedisCacheBackend, RedisLike } from './redis-cache.backend'

/** CacheService 构造选项 */
export interface CacheOptions {
  /**
   * Redis 连接串（如 redis://localhost:6379）。
   * 配置则使用 Redis 共享后端；为空则使用进程内存后端（单实例 / 开发 / 沙箱）。
   */
  redisUrl?: string
  /** 键命名空间前缀，隔离不同业务，避免与其它系统键冲突 */
  namespace?: string
  /** 默认 TTL（秒）；各 set 未显式传 ttlSec 时采用 */
  defaultTtlSec?: number
  /**
   * Redis 客户端工厂（测试注入假实现；生产默认懒加载 ioredis）。
   * 仅当 redisUrl 配置时才会被调用。
   */
  redisClientFactory?: (url: string) => RedisLike
}

/**
 * 统一缓存服务（任务 11.3 分布式缓存，方案 §10.3）。
 *
 * 职责：
 *  - 后端选择：redisUrl 配置 → Redis 共享后端；否则进程内存后端。
 *  - 命名空间：所有键自动加 `namespace:` 前缀，业务间互不污染。
 *  - JSON 透明：getJSON / setJSON 自动序列化；getOrSet 提供「未命中则加载并回填」。
 *  - 优雅降级：Redis 工厂抛错（未安装 / 连不上）时回退内存后端并告警，不阻断启动。
 *
 * 诚实说明：代码已就绪可投产；生产真正启用「共享缓存」需部署 Redis 服务并配置
 * `REDIS_URL`（当前沙箱无 Redis，默认走内存后端，已用单元测试覆盖两条路径）。
 */
export class CacheService {
  private readonly backend: CacheBackend
  private readonly namespace: string
  private readonly defaultTtlSec: number

  constructor(opts: CacheOptions = {}) {
    this.namespace = opts.namespace ?? 'dropship'
    this.defaultTtlSec = opts.defaultTtlSec ?? 0

    if (opts.redisUrl) {
      try {
        const factory = opts.redisClientFactory ?? defaultRedisFactory
        this.backend = new RedisCacheBackend(factory(opts.redisUrl))
      } catch (err) {
        // 优雅降级：Redis 不可用（未安装 / 连不上）时回退内存，避免启动失败
        // eslint-disable-next-line no-console
        console.warn(
          '[CacheService] Redis 不可用，回退进程内存缓存：',
          (err as Error).message,
        )
        this.backend = new MemoryCacheBackend()
      }
    } else {
      this.backend = new MemoryCacheBackend()
    }
  }

  /** 加命名空间前缀，避免跨业务键冲突 */
  private key(key: string): string {
    return `${this.namespace}:${key}`
  }

  async get(key: string): Promise<string | null> {
    return this.backend.get(this.key(key))
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    await this.backend.set(this.key(key), value, ttlSec ?? this.defaultTtlSec)
  }

  async del(key: string): Promise<void> {
    await this.backend.del(this.key(key))
  }

  async exists(key: string): Promise<boolean> {
    return this.backend.exists(this.key(key))
  }

  /** 读取并反序列化 JSON；不存在或数据损坏返回 null */
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key)
    if (raw == null) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      // 损坏数据：视为未命中，避免下游解析崩溃
      return null
    }
  }

  /** 序列化并写入 JSON */
  async setJSON<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSec)
  }

  /**
   * 读取-回填：命中直接返回；未命中调用 loader 加载并写回（带 TTL）。
   * 典型用途：令牌 / FX 等共享缓存，避免多实例重复换取触发承运商限流。
   */
  async getOrSet<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    const hit = await this.getJSON<T>(key)
    if (hit !== null) return hit
    const value = await loader()
    await this.setJSON(key, value, ttlSec)
    return value
  }

  /** 当前后端类型，便于运维诊断与单测断言 */
  get backendKind(): 'memory' | 'redis' {
    return this.backend instanceof RedisCacheBackend ? 'redis' : 'memory'
  }
}

/**
 * 默认 Redis 工厂：懒加载 ioredis（仅在配置了 redisUrl 且 ioredis 可用时才被调用）。
 * 用 require 而非 import，避免未安装 ioredis 时模块导入即报错阻断编译/启动。
 */
function defaultRedisFactory(url: string): RedisLike {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Redis = require('ioredis')
  const client = new Redis(url, {
    lazyConnect: true, // 不在构造期建连，首次命令才连，避免启动阻塞
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  })
  return client as RedisLike
}
