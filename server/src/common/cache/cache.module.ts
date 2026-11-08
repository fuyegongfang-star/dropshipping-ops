import { Global, Module } from '@nestjs/common'
import { CacheService } from './cache.service'

/**
 * 缓存模块（任务 11.3，方案 §10.3）。
 *
 * 全局提供 CacheService：默认 namespace=`dropship`；配置环境变量 `REDIS_URL` 即切换
 * Redis 共享后端，否则进程内存后端（单实例 / 开发 / 沙箱零依赖）。
 * 各业务模块（承运商令牌、FX 汇率等）直接 inject(CacheService) 即可。
 */
@Global()
@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: () =>
        new CacheService({
          redisUrl: process.env.REDIS_URL,
          namespace: process.env.REDIS_NAMESPACE ?? 'dropship',
        }),
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
