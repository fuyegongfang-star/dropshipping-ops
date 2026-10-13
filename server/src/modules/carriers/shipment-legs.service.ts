/**
 * 两段式运单编排服务（任务 3.8，方案 §14 头程/尾程两段式物流模型）。
 *
 * 背景：跨境物流本质是两段，原方案把物流当单段处理。头程 first_leg（国内仓/工厂 → 海外仓/FBA）
 *       与尾程 last_leg（海外仓/FBA → 买家）往往由不同承运商承运，需拆分为独立运单、独立成本与时效。
 *
 * 职责：给定「头程承运商 + 尾程承运商 + 全程请求」，自动拆为两段 CreateShipmentRequest，
 *       分别调用 CarriersService.ship 建单，再聚合为 ComposeShipmentResult（含两段 legs）。
 *       仅指定一段（firstCarrierCode 或 lastCarrierCode）时退化为单段运单。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { Injectable } from '@nestjs/common'
import { CarriersService } from './carriers.service'
import { CarrierCode } from './carrier.constants'
import { CreateShipmentRequest, CreateShipmentResult, ComposeShipmentResult, ShipmentLegResult } from './dto/shipment.dto'
import { LegType } from './dto/rate.dto'

/** 两段式建单编排请求 */
export interface ComposeShipmentRequest {
  /** 头程承运商代码（国内 → 海外仓/FBA） */
  firstCarrierCode: CarrierCode
  /** 尾程承运商代码（海外仓/FBA → 买家）；省略则全程由头程承运商一票到底 */
  lastCarrierCode?: CarrierCode
  /** 转运节点 / 海外仓代码：头程终点 = 尾程起点（如 OVERSEAS-US-WEST） */
  transitHub?: string
  /** 全程建单入参（origin / destCountry / parcels / recipient / customs 等） */
  shipment: CreateShipmentRequest
}

@Injectable()
export class ShipmentLegsService {
  constructor(private readonly carriers: CarriersService) {}

  /**
   * 编排两段式运单：
   * - 全程（first + last）：头程建单 origin → transitHub；尾程建单 transitHub → destCountry。
   * - 单段（仅头程 / 仅尾程）：直接一票到底，legType 置 FIRST/LAST。
   */
  async compose(tenantId: string, req: ComposeShipmentRequest): Promise<ComposeShipmentResult> {
    const { firstCarrierCode, lastCarrierCode, transitHub, shipment } = req
    const hub = transitHub ?? `OVERSEAS-${shipment.destCountry}`

    // 仅尾程：国内段由上游（供应商/头程服务）负责，本平台只建尾程单
    if (!lastCarrierCode) {
      const res = await this.carriers.ship(tenantId, firstCarrierCode, {
        ...shipment,
        legType: LegType.FIRST,
      })
      return this.aggregate([this.toLeg(LegType.FIRST, firstCarrierCode, res, undefined)], shipment.orderRef)
    }

    // 全程：头程 + 尾程两段
    const firstRes = await this.carriers.ship(tenantId, firstCarrierCode, {
      ...shipment,
      legType: LegType.FIRST,
      destCountry: hub,
      destZip: undefined,
      recipient: undefined,
    })
    const lastRes = await this.carriers.ship(tenantId, lastCarrierCode, {
      ...shipment,
      legType: LegType.LAST,
      origin: hub,
      recipient: shipment.recipient,
    })
    const legs = [
      this.toLeg(LegType.FIRST, firstCarrierCode, firstRes, hub),
      this.toLeg(LegType.LAST, lastCarrierCode, lastRes, hub),
    ]
    return this.aggregate(legs, shipment.orderRef)
  }

  /** 聚合各段成本，生成编排结果 */
  private aggregate(legs: ShipmentLegResult[], orderRef?: string): ComposeShipmentResult {
    const currency = legs[0]?.currency ?? 'USD'
    const totalCarrierCost = Number(
      legs.reduce((sum, l) => sum + (l.carrierCost || 0), 0).toFixed(2),
    )
    return {
      orderRef,
      legs,
      totalCarrierCost,
      currency,
      composedAt: new Date().toISOString(),
    }
  }

  /** 把单段建单结果映射为 ShipmentLegResult（统一 leg 维度） */
  private toLeg(
    legType: LegType,
    carrierCode: CarrierCode,
    res: CreateShipmentResult,
    transitHub?: string,
  ): ShipmentLegResult {
    return {
      legType,
      carrierCode,
      waybillNo: res.waybillNo,
      trackingNo: res.trackingNo,
      labelUrl: res.labelUrl,
      carrierCost: res.carrierCost,
      currency: res.currency,
      estimatedLeadDays: res.estimatedLeadDays,
      transitHub,
    }
  }
}
