/** 缓存模块统一出口（任务 11.3 分布式缓存，方案 §10.3）。 */
export { CacheService } from './cache.service'
export type { CacheOptions } from './cache.service'
export { CacheModule } from './cache.module'
export type { CacheBackend } from './cache-backend.interface'
export { MemoryCacheBackend } from './memory-cache.backend'
export { RedisCacheBackend } from './redis-cache.backend'
export type { RedisLike } from './redis-cache.backend'
