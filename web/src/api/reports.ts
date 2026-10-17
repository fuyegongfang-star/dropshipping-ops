import http from './http'

/**
 * 运营报表接口封装（任务 4.7，方案 §25 报表指标）。
 * 后端 `GET /reports/overview` 聚合五类看板指标；
 * 演示模式下由 mock-data.ts 返回同口径数据（前端无需后端即可看板）。
 */

/** 履约时效：单段时长与达成率 */
export interface FulfillmentSlaStage {
  stage: string
  label: string
  avgHours: number
  achievedRate: number
}
export interface FulfillmentSla {
  stages: FulfillmentSlaStage[]
  overallAchievedRate: number
}

/** 物流时效：各渠道平均时效与异常率 */
export interface LogisticsSlaChannel {
  carrierCode: string
  carrierName: string
  avgTransitDays: number
  exceptionRate: number
}
export interface LogisticsSla {
  channels: LogisticsSlaChannel[]
}

/** 利润趋势点 */
export interface ProfitTrendPoint {
  period: string
  spread: number
  totalSell: number
  totalCost: number
}
export interface ProfitByTenant {
  tenantId: string
  tenantName: string
  margin: number
  marginRate: number
}
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
  orderCount: number
  weightKg: number
  revenue: number
  share: number
}
export interface ChannelDistribution {
  items: ChannelDistItem[]
}

/** 异常构成单项 */
export interface ExceptionItem {
  type: string
  label: string
  count: number
  rate: number
}
export interface ExceptionReport {
  items: ExceptionItem[]
  overallRate: number
}

/** 运营报表总览 */
export interface ReportDashboard {
  fulfillmentSla: FulfillmentSla
  logisticsSla: LogisticsSla
  profit: ProfitReport
  channelDistribution: ChannelDistribution
  exceptionRate: ExceptionReport
  generatedAt: string
}

export const reportsApi = {
  /** 运营报表总览（履约/物流时效 + 利润 + 渠道分布 + 异常率）。 */
  overview: () => http.get<ReportDashboard>('/reports/overview'),
}
