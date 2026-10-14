/**
 * 承运商适配器抽象基类（方案 §3：所有适配器继承，复用网络/日志/归一化脚手架）。
 * 具体承运商（云途/DHL/4PX/燕文）只需实现抽象方法，无需关心重试/超时等通用逻辑。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { AppLogger } from '../../common/logger/app.logger'
import { RetryableHttpService, RetryableRequestOptions } from '../../common/http/retryable-http.service'
import { CarrierCapability, CarrierCode, CarrierHealth } from './carrier.constants'
import { GetRatesRequest, RateQuote } from './dto/rate.dto'
import { CarrierLabel, CreateShipmentRequest, CreateShipmentResult } from './dto/shipment.dto'
import { CarrierTrackingResult } from './dto/tracking.dto'
import { CarrierAdapter } from './carrier-adapter.interface'

export abstract class AbstractCarrierAdapter implements CarrierAdapter {
  protected readonly carrier: CarrierCode

  constructor(
    carrier: CarrierCode,
    protected readonly http: RetryableHttpService,
    protected readonly logger: AppLogger,
  ) {
    this.carrier = carrier
  }

  /** 返回承运商代码，供注册表分发 */
  getCode(): CarrierCode {
    return this.carrier
  }

  /** 公开能力查询（供轨迹双通道判定：是否支持推送订阅，§6/§3） */
  getCapabilities(): CarrierCapability[] {
    return this.capabilities()
  }

  /**
   * 默认健康检查：返回适配器支持的能力（无网络探测）。
   * 需要真实探测的承运商（如打 ping/rate 接口）应覆盖本方法，复用 this.http 重试能力。
   */
  async healthCheck(): Promise<CarrierHealth> {
    return {
      healthy: true,
      message: 'adapter ready (no probe)',
      capabilities: this.capabilities(),
    }
  }

  /** 子类声明支持的能力（默认全能力；真实适配器按需裁剪，如聚合平台仅 TRACK） */
  protected capabilities(): CarrierCapability[] {
    return [
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
      CarrierCapability.CANCEL,
      CarrierCapability.SUBSCRIBE,
    ]
  }

  /** 受保护：带重试的 JSON 请求（统一走 RetryableHttpService，§2.1） */
  protected requestJson<T = unknown>(url: string, options?: RetryableRequestOptions): Promise<T> {
    return this.http.requestJson<T>(url, options)
  }

  // —— 以下为承运商相关实现，由具体适配器完成 ——
  abstract getRates(req: GetRatesRequest): Promise<RateQuote[]>
  abstract createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult>
  abstract getLabel(waybillNo: string): Promise<CarrierLabel>
  abstract getTracking(no: string): Promise<CarrierTrackingResult>
  abstract cancelShipment(no: string): Promise<void>
  abstract subscribeTracking(no: string): Promise<void>
}
