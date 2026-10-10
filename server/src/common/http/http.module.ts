import { Global, Module } from '@nestjs/common'
import { RetryableHttpService } from './retryable-http.service'
import { AppLogger } from '../logger/app.logger'

/**
 * HTTP 模块（方案 §2.1 通用 HTTP 客户端层）。
 * 全局提供 RetryableHttpService 与 AppLogger，供渠道适配器（§3 拉单/回传）、
 * 承运商适配器（§3）及全仓 Service 共用，统一超时/重试/指数退避与日志。
 */
@Global()
@Module({
  providers: [RetryableHttpService, AppLogger],
  exports: [RetryableHttpService, AppLogger],
})
export class HttpModule {}
