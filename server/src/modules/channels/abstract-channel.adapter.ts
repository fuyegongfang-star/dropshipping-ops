/**
 * 渠道适配器抽象基类（方案 §3：所有适配器继承，复用网络/日志/归一化脚手架）。
 * 具体平台适配器（Shopify 等）只需实现抽象方法，无需关心重试/超时等通用逻辑。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { AppLogger } from '../../common/logger/app.logger'
import { RetryableHttpService, RetryableRequestOptions } from '../../common/http/retryable-http.service'
import { ChannelHealth, ChannelPlatform, ChannelPullOptions, ChannelOrderStatus } from './channel.constants'
import { PulledChannelOrderResult } from './dto/pulled-order.dto'
import {
  ChannelFulfillmentDto,
  ChannelFulfillmentResult,
  ChannelTrackingResult,
} from './dto/channel-fulfillment.dto'
import { ChannelAdapter } from './channel-adapter.interface'

export abstract class AbstractChannelAdapter implements ChannelAdapter {
  protected readonly platform: ChannelPlatform

  constructor(
    platform: ChannelPlatform,
    protected readonly http: RetryableHttpService,
    protected readonly logger: AppLogger,
  ) {
    this.platform = platform
  }

  /** 返回平台代码，供注册表分发 */
  getPlatform(): ChannelPlatform {
    return this.platform
  }

  /**
   * 默认健康检查：仅确认适配器就绪（无网络探测）。
   * 需要真实探测的平台（如打 ping 接口）应覆盖本方法，复用 this.http 重试能力。
   */
  async healthCheck(): Promise<ChannelHealth> {
    return { healthy: true, message: 'adapter ready (no probe)' }
  }

  /** 受保护：带重试的 JSON 请求（统一走 RetryableHttpService，§2.1） */
  protected requestJson<T = unknown>(url: string, options?: RetryableRequestOptions): Promise<T> {
    return this.http.requestJson<T>(url, options)
  }

  // —— 以下为平台相关实现，由具体适配器完成 ——
  abstract pullOrders(options: ChannelPullOptions): Promise<PulledChannelOrderResult[]>
  abstract acknowledgeOrders(orderNos: string[]): Promise<void>
  abstract pushFulfillment(fulfillment: ChannelFulfillmentDto): Promise<ChannelFulfillmentResult>
  abstract fetchOrderStatus(platformOrderNo: string): Promise<ChannelOrderStatus>
  abstract cancelOrder(platformOrderNo: string): Promise<void>
  abstract getTracking(platformOrderNo: string): Promise<ChannelTrackingResult>
}
