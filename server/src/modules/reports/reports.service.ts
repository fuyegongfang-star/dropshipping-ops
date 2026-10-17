import { Injectable } from '@nestjs/common'
import {
  ReportDashboard,
  FulfillmentSla,
  LogisticsSla,
  ProfitReport,
  ChannelDistribution,
  ExceptionReport,
} from './reports.types'

/**
 * 运营报表服务（任务 4.7，方案 §25）。
 * 聚合履约时效 / 物流时效 / 利润 / 渠道分布 / 异常率 五类看板指标。
 *
 * 真实口径（TODO(platform): 2026-11 接入）：
 *  - 履约/物流时效：由订单与运单事件（order_events / shipment 状态流转）计算各段时长与达成率；
 *  - 利润：由 §10 双价列（sell_price − carrier_cost）按租户/渠道聚合，配合 §16 ledger；
 *  - 渠道分布 / 异常率：由订单与运单状态分布统计。
 * 当前后端无演示数据库，返回**演示口径代表值**，前端 mock 与之同口径，保证看板可见。
 */
@Injectable()
export class ReportsService {
  /** 运营报表总览：五类指标一次性返回，前端单请求渲染看板。 */
  getDashboard(): ReportDashboard {
    return {
      fulfillmentSla: this.buildFulfillmentSla(),
      logisticsSla: this.buildLogisticsSla(),
      profit: this.buildProfit(),
      channelDistribution: this.buildChannelDistribution(),
      exceptionRate: this.buildExceptionRate(),
      generatedAt: new Date().toISOString(),
    }
  }

  /** 履约时效：下单→推单→揽收→签收 各段平均时长与达成率。 */
  private buildFulfillmentSla(): FulfillmentSla {
    const stages = [
      { stage: 'order→push', label: '下单→推单', avgHours: 2.5, achievedRate: 0.98 },
      { stage: 'push→pickup', label: '推单→揽收', avgHours: 18, achievedRate: 0.95 },
      { stage: 'pickup→sign', label: '揽收→签收', avgHours: 120, achievedRate: 0.93 },
    ]
    // 整体达成率 = 各段达成率的几何均值（任一段失败即链路失败）
    const overallAchievedRate = Number(
      Math.pow(stages.reduce((acc, s) => acc * s.achievedRate, 1), 1 / stages.length).toFixed(4),
    )
    return { stages, overallAchievedRate }
  }

  /** 物流时效：各渠道平均时效与异常率。 */
  private buildLogisticsSla(): LogisticsSla {
    const channels = [
      { carrierCode: 'yunexpress', carrierName: '云途物流', avgTransitDays: 7.5, exceptionRate: 0.021 },
      { carrierCode: 'dhl', carrierName: 'DHL 快递', avgTransitDays: 4.2, exceptionRate: 0.009 },
      { carrierCode: '4px', carrierName: '4PX 递四方', avgTransitDays: 11.0, exceptionRate: 0.038 },
      { carrierCode: 'yanwen', carrierName: '燕文物流', avgTransitDays: 8.5, exceptionRate: 0.031 },
    ]
    return { channels }
  }

  /** 利润：近 6 账期趋势 + 按租户/渠道拆解。 */
  private buildProfit(): ProfitReport {
    const trend = [
      { period: '2026-05', spread: 182000, totalSell: 1320000, totalCost: 1138000 },
      { period: '2026-06', spread: 205000, totalSell: 1450000, totalCost: 1245000 },
      { period: '2026-07', spread: 198000, totalSell: 1510000, totalCost: 1312000 },
      { period: '2026-08', spread: 231000, totalSell: 1680000, totalCost: 1449000 },
      { period: '2026-09', spread: 246000, totalSell: 1750000, totalCost: 1504000 },
      { period: '2026-10', spread: 268000, totalSell: 1890000, totalCost: 1622000 },
    ]
    const byTenant = [
      { tenantId: 't_demo', tenantName: '示例租户', margin: 142000, marginRate: 0.11 },
      { tenantId: 't_acme', tenantName: 'Acme 贸易', margin: 126000, marginRate: 0.12 },
    ]
    const byChannel = [
      { carrierCode: 'yunexpress', carrierName: '云途物流', margin: 142000 },
      { carrierCode: 'dhl', carrierName: 'DHL 快递', margin: 98000 },
      { carrierCode: '4px', carrierName: '4PX 递四方', margin: 18000 },
      { carrierCode: 'yanwen', carrierName: '燕文物流', margin: 10000 },
    ]
    return { trend, byTenant, byChannel }
  }

  /** 渠道分布：单量 / 重量 / 收入占比。 */
  private buildChannelDistribution(): ChannelDistribution {
    const items = [
      { carrierCode: 'yunexpress', carrierName: '云途物流', orderCount: 4200, weightKg: 31000, revenue: 980000, share: 0.52 },
      { carrierCode: 'dhl', carrierName: 'DHL 快递', orderCount: 1800, weightKg: 22000, revenue: 560000, share: 0.3 },
      { carrierCode: '4px', carrierName: '4PX 递四方', orderCount: 2200, weightKg: 9000, revenue: 210000, share: 0.11 },
      { carrierCode: 'yanwen', carrierName: '燕文物流', orderCount: 1400, weightKg: 8000, revenue: 140000, share: 0.07 },
    ]
    return { items }
  }

  /** 异常率：丢件 / 延误 / 拒收 构成 + 综合异常率。 */
  private buildExceptionRate(): ExceptionReport {
    const items = [
      { type: 'delay', label: '延误', count: 320, rate: 0.032 },
      { type: 'reject', label: '拒收', count: 86, rate: 0.0086 },
      { type: 'lost', label: '丢件', count: 12, rate: 0.0012 },
    ]
    const overallRate = Number(items.reduce((acc, i) => acc + i.rate, 0).toFixed(4))
    return { items, overallRate }
  }
}
