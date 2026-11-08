/**
 * CacheService 单测（任务 11.3 分布式缓存，方案 §10.3）。
 * 覆盖：内存后端 TTL 过期、Redis 后端（内存假实现，无需真实 Redis）、
 * CacheService 命名空间 / JSON 透明 / getOrSet、以及 Redis 不可用时的优雅降级。
 */
import { CacheService } from './cache.service'
import { MemoryCacheBackend } from './memory-cache.backend'
import { RedisCacheBackend, RedisLike } from './redis-cache.backend'

/** 内存假 Redis：实现 RedisLike 最小子集，验证 Redis 后端逻辑（不依赖真实 Redis 服务） */
class FakeRedis implements RedisLike {
  private store = new Map<string, string>()
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async set(key: string, value: string, ..._args: unknown[]): Promise<unknown> {
    // 兼容 ioredis：SET key value 与 SET key value EX sec（fake 不强制过期）
    this.store.set(key, value)
    return 'OK'
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }
  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0
  }
}

describe('MemoryCacheBackend', () => {
  it('set/get/exists/del 基本读写', async () => {
    const b = new MemoryCacheBackend()
    expect(await b.get('k')).toBeNull()
    await b.set('k', 'v')
    expect(await b.get('k')).toBe('v')
    expect(await b.exists('k')).toBe(true)
    await b.del('k')
    expect(await b.get('k')).toBeNull()
    expect(await b.exists('k')).toBe(false)
  })

  it('TTL 过期后读取返回 null（惰性过期）', async () => {
    const b = new MemoryCacheBackend()
    await b.set('k', 'v', 1) // 1 秒过期
    expect(await b.get('k')).toBe('v')
    await new Promise((r) => setTimeout(r, 1100))
    expect(await b.get('k')).toBeNull()
    expect(await b.exists('k')).toBe(false)
  })
})

describe('RedisCacheBackend', () => {
  it('经假 Redis 客户端完成 set/get/del/exists', async () => {
    const b = new RedisCacheBackend(new FakeRedis())
    await b.set('rk', 'rv')
    expect(await b.get('rk')).toBe('rv')
    expect(await b.exists('rk')).toBe(true)
    await b.del('rk')
    expect(await b.get('rk')).toBeNull()
  })
})

describe('CacheService', () => {
  it('未配置 redisUrl → 内存后端，JSON 透明 + 命名空间前缀', async () => {
    const svc = new CacheService({ namespace: 'test' })
    expect(svc.backendKind).toBe('memory')
    await svc.setJSON('user:1', { id: 1, name: 'a' })
    expect(await svc.getJSON<{ id: number }>('user:1')).toEqual({ id: 1, name: 'a' })
    // 命名空间前缀：底层以 `namespace:key` 存储
    expect(await svc.get('user:1')).toBe('{"id":1,"name":"a"}')
  })

  it('getOrSet 未命中时加载并回填，再次命中不再调用 loader', async () => {
    const svc = new CacheService()
    let calls = 0
    const load = async () => {
      calls++
      return { v: 'x' }
    }
    const first = await svc.getOrSet('g', 60, load)
    const second = await svc.getOrSet('g', 60, load)
    expect(first).toEqual({ v: 'x' })
    expect(second).toEqual({ v: 'x' })
    expect(calls).toBe(1) // 仅首次加载
  })

  it('配置 redisUrl + 假工厂 → Redis 后端，JSON 与 getOrSet 正常', async () => {
    const svc = new CacheService({
      redisUrl: 'redis://fake',
      namespace: 'ns',
      redisClientFactory: () => new FakeRedis(),
    })
    expect(svc.backendKind).toBe('redis')
    await svc.setJSON('tok', { accessToken: 'abc', expiresAtMs: Date.now() + 1000 })
    expect(await svc.getJSON<{ accessToken: string }>('tok')).toEqual({
      accessToken: 'abc',
      expiresAtMs: expect.any(Number),
    })
    let calls = 0
    const v = await svc.getOrSet('g2', 30, async () => {
      calls++
      return 42
    })
    expect(v).toBe(42)
    expect(calls).toBe(1)
    // 再次命中
    expect(await svc.getOrSet('g2', 30, async () => 99)).toBe(42)
    expect(calls).toBe(1)
  })

  it('Redis 工厂抛错 → 优雅降级为内存后端且不阻断', async () => {
    const svc = new CacheService({
      redisUrl: 'redis://broken',
      redisClientFactory: () => {
        throw new Error('ioredis not installed')
      },
    })
    expect(svc.backendKind).toBe('memory')
    await svc.setJSON('fallback', { ok: true })
    expect(await svc.getJSON<{ ok: boolean }>('fallback')).toEqual({ ok: true })
  })
})
