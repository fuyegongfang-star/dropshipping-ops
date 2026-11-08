import { CacheBackend } from './cache-backend.interface'

/**
 * Redis 客户端最小接口（仅缓存所需子集，任务 11.3 方案 §10.3）。
 *
 * 真实环境由 ioredis 实例满足；单元测试可注入内存假实现，无需真实 Redis 服务。
 * 方法签名对齐 ioredis：`set(key, value, 'EX', seconds)` 设置带过期的字符串。
 */
export interface RedisLike {
  get(key: string): Promise<string | null>
  /** 对齐 ioredis：set(key, value, 'EX', ttlSec) 带过期；无过期时 set(key, value) */
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>
  del(key: string): Promise<number>
  exists(key: string): Promise<number>
}

/**
 * Redis 共享缓存后端（任务 11.3，方案 §10.3）。
 *
 * 多实例共享令牌 / FX 缓存，避免重复换取触发承运商限流（云途 / DHL 有每分钟配额）；
 * 支持 TTL 自动过期。ioredis 实例由 CacheService 经懒加载工厂创建（未安装时不报导入错误）。
 */
export class RedisCacheBackend implements CacheBackend {
  constructor(private readonly client: RedisLike) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSec = 0): Promise<void> {
    if (ttlSec > 0) {
      // ioredis：SET key value EX seconds
      await this.client.set(key, value, 'EX', ttlSec)
    } else {
      // 不过期：不带 EX（ioredis 不支持 EX 0）
      await this.client.set(key, value)
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key)
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0
  }
}
