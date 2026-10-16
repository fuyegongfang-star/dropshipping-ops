import http from './http'

/**
 * 商户账单与承运商对账接口封装（任务 4.2，方案 §9/§10/§16.4）。
 * 对接后端 /billing/*；演示模式由 mock-data.ts 返回等价数据（同口径聚合）。
 */

/** 商户账单（基于 sell_price 聚合） */
export interface BillItem {
  id: string
  tenantId: string
  /** 账期，如 2026-10 */
  period: string
  currency: string
  /** Σ sell_price（商户应付） */
  totalSell: number
  itemCount: number
  /** draft | issued | settled */
  status: string
  createdAt: string
}

/** 承运商对账（基于 carrier_cost 聚合） */
export interface ReconciliationItem {
  id: string
  carrierCode: string
  period: string
  currency: string
  /** Σ carrier_cost（平台应付承运商） */
  totalCost: number
  itemCount: number
  /** open | matched | closed */
  status: string
  createdAt: string
}

/** 平台利润核算（§9 spread = Σ sell − Σ cost） */
export interface ProfitSummary {
  period: string
  currency: string
  totalSell: number
  totalCost: number
  profit: number
  marginRate: number
  billCount: number
  reconciliationCount: number
}

/** 出账 / 对账生成结果 */
export interface GenerateResult {
  period: string
  generated: number
  updated: number
}

/** 单租户利润贡献（§9 spread 收入侧分摊） */
export interface TenantProfit {
  tenantId: string
  totalSell: number
  totalCost: number
  profit: number
  marginRate: number
}

/** 单承运商成本贡献 */
export interface CarrierCost {
  carrierCode: string
  totalCost: number
}

/** 利润核算明细（§9 spread 多维拆解） */
export interface ProfitBreakdown {
  summary: ProfitSummary
  byTenant: TenantProfit[]
  byCarrier: CarrierCost[]
}

/** 账单状态中文标签 */
export const BILL_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  issued: '已出账',
  settled: '已结清',
}

/** 账单状态徽章配色 */
export const BILL_STATUS_TAG: Record<string, 'info' | 'warning' | 'success'> = {
  draft: 'info',
  issued: 'warning',
  settled: 'success',
}

/** 对账状态中文标签 */
export const RECON_STATUS_LABELS: Record<string, string> = {
  open: '未对账',
  matched: '已匹配',
  closed: '已关闭',
}

/** 对账状态徽章配色 */
export const RECON_STATUS_TAG: Record<string, 'info' | 'warning' | 'success'> = {
  open: 'info',
  matched: 'warning',
  closed: 'success',
}

export const billingApi = {
  /** 生成商户账单（按账期聚合 sell_price，平台级） */
  generateBills: (period: string, tenantId?: string) =>
    http.post<GenerateResult>(
      `/billing/bills/generate?period=${period}${tenantId ? `&tenantId=${tenantId}` : ''}`,
    ),
  /** 商户账单列表（按当前租户隔离） */
  listBills: (status?: string) => http.get<BillItem[]>(`/billing/bills${status ? `?status=${status}` : ''}`),
  /** 账单详情 */
  getBill: (id: string) => http.get<BillItem>(`/billing/bills/${id}`),
  /** 出账（draft → issued） */
  issueBill: (id: string) => http.post<BillItem>(`/billing/bills/${id}/issue`),
  /** 结清（issued → settled） */
  settleBill: (id: string) => http.post<BillItem>(`/billing/bills/${id}/settle`),
  /** 生成承运商对账（按承运商+账期聚合 carrier_cost） */
  generateReconciliations: (period: string) =>
    http.post<GenerateResult>(`/billing/reconciliations/generate?period=${period}`),
  /** 承运商对账列表（平台级） */
  listReconciliations: (status?: string) =>
    http.get<ReconciliationItem[]>(`/billing/reconciliations${status ? `?status=${status}` : ''}`),
  /** 对账详情 */
  getReconciliation: (id: string) => http.get<ReconciliationItem>(`/billing/reconciliations/${id}`),
  /** 匹配（open → matched） */
  matchReconciliation: (id: string) => http.post<ReconciliationItem>(`/billing/reconciliations/${id}/match`),
  /** 关闭对账 */
  closeReconciliation: (id: string) => http.post<ReconciliationItem>(`/billing/reconciliations/${id}/close`),
  /** 平台利润核算（§9 spread） */
  getProfit: (period: string) => http.get<ProfitSummary>(`/billing/profit?period=${period}`),
  /** 利润核算明细：总览 + 按租户 / 承运商拆解（§9 spread 报表化） */
  getProfitBreakdown: (period: string) => http.get<ProfitBreakdown>(`/billing/profit/breakdown?period=${period}`),
  /** 利润趋势：最近 N 个账期平台利润概览（默认 6 个月，§9 spread 时序化） */
  getProfitTrend: (months = 6) => http.get<ProfitSummary[]>(`/billing/profit/trend?months=${months}`),
}
