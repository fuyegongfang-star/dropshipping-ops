/**
 * 报表指标类型定义（任务 4.7，方案 §25 报表指标定义）。
 * 覆盖履约时效 / 物流时效 / 利润 / 渠道分布 / 异常率 五类运营看板指标。
 * 真实口径由 §10 双价列 + §16 ledger + 订单/运单事件聚合支撑；
 * 当前后端返回为演示口径代表值（TODO(platform): 2026-11 接入真实聚合）。
 */

/** 履约时效：单段时长与达成率 */
export interface FulfillmentSlaStage {
  /** 阶段标识：order→push / push→pickup / pickup→sign */
  stage: string
  /** 中文阶段名 */
  label: string
  /** 平均时长（小时） */
  avgHours: number
  /** 达成率（0~1） */
  achievedRate: number
}

export interface FulfillmentSla {
  stages: FulfillmentSlaStage[]
  /** 整体达成率（0~1） */
  overallAchievedRate: number
}

/** 物流时效：各渠道平均时效与异常率 */
export interface LogisticsSlaChannel {
  carrierCode: string
  carrierName: string
  /** 平均时效（天） */
  avgTransitDays: number
  /** 异常率（0~1） */
  exceptionRate: number
}

export interface LogisticsSla {
  channels: LogisticsSlaChannel[]
}

/** 利润趋势点（近 N 账期） */
export interface ProfitTrendPoint {
  period: string
  /** 平台 spread（利润，基准币） */
  spread: number
  /** 应收合计 */
  totalSell: number
  /** 应付合计 */
  totalCost: number
}

/** 按租户利润贡献 */
export interface ProfitByTenant {
  tenantId: string
  tenantName: string
  /** 平台利润（spread） */
  margin: number
  /** 毛利率（0~1） */
  marginRate: number
}

/** 按渠道利润 */
export interface ProfitByChannel {
  carrierCode: string
  carrierName: string
  margin: number
}

export interface ProfitReport {
  trend: ProfitTrendPoint[]
  byTenant: ProfitByTenant[]
  byChannel: ProfitByChannel[]
}

/** 渠道分布单项 */
export interface ChannelDistItem {
  carrierCode: string
  carrierName: string
  /** 单量 */
  orderCount: number
  /** 总重量（kg） */
  weightKg: number
  /** 收入（基准币） */
  revenue: number
  /** 单量占比（0~1） */
  share: number
}

export interface ChannelDistribution {
  items: ChannelDistItem[]
}

/** 异常构成单项 */
export interface ExceptionItem {
  /** 异常类型：lost / delay / reject */
  type: string
  /** 中文标签 */
  label: string
  count: number
  /** 占比（0~1） */
  rate: number
}

export interface ExceptionReport {
  items: ExceptionItem[]
  /** 综合异常率（0~1） */
  overallRate: number
}

/** 运营报表总览（§25 五类指标汇总） */
export interface ReportDashboard {
  fulfillmentSla: FulfillmentSla
  logisticsSla: LogisticsSla
  profit: ProfitReport
  channelDistribution: ChannelDistribution
  exceptionRate: ExceptionReport
  generatedAt: string
}
