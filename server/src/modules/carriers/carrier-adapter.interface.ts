/**
 * 承运商适配器统一接口（方案 §3 承运商适配器架构，镜像 ChannelAdapter）。
 * 所有物流服务商（云途/DHL/4PX/燕文/聚合平台）实现本接口，对外暴露
 * 「比价 / 建单(推单) / 面单 / 轨迹 / 取消 / 订阅」能力，由 CarrierRegistryService 按 code 注册与分发。
 *
 * 六大能力映射（任务 3.1）：
 *   - getRates        比价/运费试算：返回多产品报价（§3 getRates）
 *   - createShipment  建单/推单：生成运单号/面单/轨迹号（§3 createShipment）
 *   - getLabel        面单获取：PDF/ZPL（§3 getLabel，落 MinIO，§2.1）
 *   - getTracking     轨迹查询：查询物流轨迹（§3/§6）
 *   - cancelShipment  取消运单：通知承运商取消（§13.2 逆向）
 *   - subscribeTracking 轨迹订阅：云途类推送订阅（§3/§6 双通道）
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { CarrierCapability, CarrierCode, CarrierHealth } from './carrier.constants'
import { GetRatesRequest, RateQuote } from './dto/rate.dto'
import { CarrierLabel, CreateShipmentRequest, CreateShipmentResult } from './dto/shipment.dto'
import { CarrierTrackingResult } from './dto/tracking.dto'

export interface CarrierAdapter {
  /** 承运商代码（用于注册表分发，对齐 Carrier.code） */
  getCode(): CarrierCode

  /** 健康/能力探测：返回可达能力与连通性 */
  healthCheck(): Promise<CarrierHealth>

  /** 比价/运费试算：返回多产品报价（§3/§4） */
  getRates(req: GetRatesRequest): Promise<RateQuote[]>

  /** 建单/推单：生成运单（§3 createShipment） */
  createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult>

  /** 面单获取：返回 PDF/ZPL（§3 getLabel） */
  getLabel(waybillNo: string): Promise<CarrierLabel>

  /** 轨迹查询：查询物流节点（§3/§6） */
  getTracking(no: string): Promise<CarrierTrackingResult>

  /** 取消运单（逆向入口，§13.2） */
  cancelShipment(no: string): Promise<void>

  /** 轨迹订阅（云途类推送，§6 双通道） */
  subscribeTracking(no: string): Promise<void>
}

/** 仅用于类型推断：适配器支持的能力清单类型（避免 any，§31） */
export type AdapterCapabilities = CarrierCapability[]
