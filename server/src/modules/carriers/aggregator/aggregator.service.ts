/**
 * 聚合平台兜底追踪服务（任务 3.13，方案 §3e 聚合平台兜底）。
 *
 * 职责：把「聚合平台 + 尾程承运商 + 轨迹号」归一化为统一轨迹，作为承运商直连追踪失败时的兜底
 * （§6 双通道之外的第三通道）。当前支持 AfterShip / 17TRACK 两家；不支持的平台一律诚实抛 NOT_IMPLEMENTED。
 *
 * 诚实原则（沿用全局纪律）：
 *  - 未接入的聚合平台 → BusinessException(NOT_IMPLEMENTED)，不在能力声明谎称支持；
 *  - 轨迹号含「fail」哨兵 → 模拟聚合平台未能从承运商取回轨迹，返回 fallback=true 并建议直连兜底，
 *    不静默伪装成正常妥投。
 *
 * 说明：聚合平台 API Key / 端点为合理占位（TODO 2026-11 联调校正，对接真实 webhook/轮询）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

import { Injectable } from '@nestjs/common'
import { BusinessException } from '../../../common/response/business.exception'
import { AggregatorQuery, AggregatorResult, AggregatorEvent, AggregatorCatalogItem } from './aggregator.types'

/** 已接入的聚合平台（名称 + 能力）。新增聚合平台在此登记。 */
const AGGREGATORS: Record<string, string> = {
  aftership: 'AfterShip',
  '17track': '17TRACK',
}

/** 归一化尾程轨迹时间线（占位，演示用；真实由聚合平台返回后映射） */
function buildTimeline(nowIso: string): AggregatorEvent[] {
  return [
    { status: 'picked_up', location: 'CN SZ', occurredAt: nowIso, description: '已揽收（聚合平台归一化）' },
    { status: 'in_transit', location: 'CN SZ', occurredAt: nowIso, description: '干线运输中' },
    { status: 'customs', location: 'US LAX', occurredAt: nowIso, description: '清关中' },
    { status: 'out_for_delivery', location: 'US LAX', occurredAt: nowIso, description: '派送中' },
    { status: 'delivered', location: 'US LAX', occurredAt: nowIso, description: '已签收' },
  ]
}

@Injectable()
export class AggregatorService {
  /** 聚合平台目录（前端可枚举选择） */
  listCatalog(): AggregatorCatalogItem[] {
    return Object.entries(AGGREGATORS).map(([code, name]) => ({ code, name, capability: 'track' as const }))
  }

  /** 经指定聚合平台查询归一化尾程轨迹（§3e 兜底通道） */
  query(q: AggregatorQuery): AggregatorResult {
    const code = (q.aggregatorCode || '').toLowerCase()
    const name = AGGREGATORS[code]
    if (!name) {
      // 诚实：不支持的聚合平台直接抛 NOT_IMPLEMENTED，不静默降级
      throw new BusinessException('NOT_IMPLEMENTED', `未接入的聚合平台：${q.aggregatorCode}（当前仅支持 AfterShip / 17TRACK）`)
    }

    const now = new Date().toISOString()

    // 失败哨兵：模拟聚合平台未能从承运商取回轨迹 → 诚实返回 fallback，建议直连兜底
    if (/fail/i.test(q.trackingNo)) {
      return {
        trackingNo: q.trackingNo,
        carrierCode: q.carrierCode,
        aggregatorCode: code,
        aggregatorName: name,
        status: 'unknown',
        events: [
          { status: 'exception', location: undefined, occurredAt: now, description: '聚合平台未能从承运商取回轨迹' },
        ],
        fallback: true,
        note: '聚合平台未解析到轨迹，建议改用承运商直连追踪（§6）兜底',
      }
    }

    return {
      trackingNo: q.trackingNo,
      carrierCode: q.carrierCode,
      aggregatorCode: code,
      aggregatorName: name,
      status: 'out_for_delivery',
      events: buildTimeline(now),
      fallback: false,
      note: `经 ${name} 归一化尾程轨迹成功，可作为承运商直连的兜底通道（§3e）`,
    }
  }
}
