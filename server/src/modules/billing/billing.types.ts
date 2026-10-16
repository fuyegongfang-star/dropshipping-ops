/**
 * 商户账单与承运商对账 DTO / 响应类型（任务 4.2，方案 §9/§10/§16.4）。
 *
 * 口径约定：
 * - 商户账单 bill：基于 Shipment.sellPrice（商户应付平台）按账期聚合（§9 spread 的收入侧）。
 * - 承运商对账 reconciliation：基于 Shipment.carrierCost（平台应付承运商）按承运商+账期聚合（§9 spread 的成本侧）。
 * - 平台利润 = Σ(sellPrice) − Σ(carrierCost)（§9 spread）。
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
  /** draft（草稿）| issued（已出账）| settled（已结清） */
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
  /** open（未对账）| matched（已匹配）| closed（已关闭） */
  status: string
  createdAt: string
}

/** 平台利润核算（§9 spread = Σ sell_price − Σ carrier_cost） */
export interface ProfitSummary {
  period: string
  currency: string
  /** 商户账单合计（应收） */
  totalSell: number
  /** 承运商对账合计（应付） */
  totalCost: number
  /** 平台利润 = totalSell − totalCost */
  profit: number
  /** 毛利率 = profit / totalSell（0 时无意义，返回 0） */
  marginRate: number
  billCount: number
  reconciliationCount: number
}

/** 出账 / 对账生成结果（批量 upsert 摘要） */
export interface GenerateResult {
  period: string
  generated: number
  updated: number
}

/** 单租户利润贡献（§9 spread 的收入侧分摊） */
export interface TenantProfit {
  tenantId: string
  /** 该租户账期应收（Σ sell_price） */
  totalSell: number
  /** 该租户账期应付（Σ carrier_cost） */
  totalCost: number
  /** 利润 = totalSell − totalCost */
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
  /** 按租户拆分（应收/应付/利润） */
  byTenant: TenantProfit[]
  /** 按承运商拆分（应付成本） */
  byCarrier: CarrierCost[]
}
