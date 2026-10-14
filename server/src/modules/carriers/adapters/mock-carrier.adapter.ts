/**
 * Mock 承运商适配器（仅用于开发与测试，无真实承运商）。
 * 提供固定比价/建单/面单/轨迹桩实现，使 CarrierAdapter 框架（任务 3.1）可在
 * 无真实 API 凭证情况下被单元测试与本地联调验证；真实承运商适配器在 3.2+ 实现后注册。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../../common/logger/app.logger'
import { RetryableHttpService } from '../../../common/http/retryable-http.service'
import { AbstractCarrierAdapter } from '../abstract-carrier.adapter'
import { CarrierCode } from '../carrier.constants'
import { GetRatesRequest, RateQuote } from '../dto/rate.dto'
import { CarrierLabel, CreateShipmentRequest, CreateShipmentResult } from '../dto/shipment.dto'
import { CarrierTrackingResult, CarrierTrackingStatus } from '../dto/tracking.dto'
import { computeChargeableWeight, DEFAULT_VOLUMETRIC_DIVISOR } from '../weight'

/** 演示单价（$/kg），仅用于 Mock 报价，非真实价 */
const MOCK_UNIT_PRICE = 60
/** 演示加价系数（§10 加价层占位；正式加价规则见 3.6，§9/§10） */
const MOCK_MARKUP = 1.2

@Injectable()
export class MockCarrierAdapter extends AbstractCarrierAdapter {
  constructor(http: RetryableHttpService, logger: AppLogger) {
    // 注册承运商代码固定为 MOCK，仅用于测试；不对应任何真实承运商
    super(CarrierCode.MOCK, http, logger)
  }

  /** 比价：基于输入计费重返回 1 个 Mock 产品报价（演示口径，非真实价） */
  async getRates(req: GetRatesRequest): Promise<RateQuote[]> {
    const { totalChargeableKg, totalVolumetricKg, isVolumetric } = computeChargeableWeight(
      req.parcels,
      DEFAULT_VOLUMETRIC_DIVISOR,
    )
    const currency = req.currency ?? 'USD'
    const carrierCost = Number((totalChargeableKg * MOCK_UNIT_PRICE).toFixed(2))
    return [
      {
        carrierCode: CarrierCode.MOCK,
        productCode: 'mock-standard',
        productName: 'Mock-标准专线',
        chargeableWeightKg: Number(totalChargeableKg.toFixed(3)),
        volumetricWeightKg: Number(totalVolumetricKg.toFixed(3)),
        isVolumetric,
        currency,
        carrierCost,
        sellPrice: Number((carrierCost * MOCK_MARKUP).toFixed(2)), // 演示加价 20%
        estimatedLeadDaysMin: 5,
        estimatedLeadDaysMax: 8,
        reachable: true,
        surcharges: [{ type: 'fuel', name: '燃油附加费', amount: 3, currency }],
        remoteArea: false,
      },
    ]
  }

  /** 建单：返回 Mock 运单/轨迹号与占位面单链接 */
  async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
    const ref = req.orderRef ?? 'ORD-MOCK'
    const { totalChargeableKg } = computeChargeableWeight(req.parcels, DEFAULT_VOLUMETRIC_DIVISOR)
    return {
      waybillNo: `MOCK-WB-${ref}`,
      trackingNo: `MOCK-TRK-${ref}`,
      labelUrl: `https://mock.label/${ref}.pdf`,
      carrierCost: Number((totalChargeableKg * MOCK_UNIT_PRICE).toFixed(2)),
      currency: req.currency ?? 'USD',
      estimatedLeadDays: 6,
    }
  }

  /** 面单：返回占位 PDF（base64 短串，仅演示） */
  async getLabel(waybillNo: string): Promise<CarrierLabel> {
    return {
      waybillNo,
      format: 'pdf',
      content: 'JVBERi0xLjQKJ...', // 占位 PDF 头，真实实现见 3.9 面单渲染（§3/§11）
      url: `https://mock.label/${waybillNo}.pdf`,
    }
  }

  /** 轨迹：返回单条节点（已揽收）；轨迹号含 NDR 哨兵时返回异常，便于演示 NDR 识别 */
  async getTracking(no: string): Promise<CarrierTrackingResult> {
    if (/ndr/i.test(no)) {
      return {
        trackingNo: no,
        carrierCode: CarrierCode.MOCK,
        status: CarrierTrackingStatus.EXCEPTION,
        events: [
          { status: CarrierTrackingStatus.PICKED_UP, location: 'Mock Warehouse', occurredAt: '2026-10-11T12:00:00.000Z', description: 'picked up (mock)' },
          { status: CarrierTrackingStatus.EXCEPTION, location: 'US LAX', occurredAt: '2026-10-12T08:30:00.000Z', description: '清关失败：申报信息不符，包裹被海关扣留' },
        ],
      }
    }
    return {
      trackingNo: no,
      carrierCode: CarrierCode.MOCK,
      status: CarrierTrackingStatus.PICKED_UP,
      events: [
        {
          status: CarrierTrackingStatus.PICKED_UP,
          location: 'Mock Warehouse',
          occurredAt: '2026-10-11T12:00:00.000Z',
          description: 'picked up (mock)',
        },
      ],
    }
  }

  /** 取消：Mock 无操作 */
  async cancelShipment(_no: string): Promise<void> {
    this.logger.debug(`[Mock] cancel ${_no} (no-op)`)
  }

  /** 订阅：Mock 无操作（云途类真实实现走 Webhook 订阅，§6 双通道） */
  async subscribeTracking(_no: string): Promise<void> {
    this.logger.debug(`[Mock] subscribe ${_no} (no-op)`)
  }
}
