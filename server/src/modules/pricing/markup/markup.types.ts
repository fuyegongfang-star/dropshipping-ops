/**
 * 加价规则引擎 + 币种归一类型（任务 3.6，方案 §10 双价列 / 加价层 / 币种归一）。
 * 加价层位于比价引擎 L4 之后、返回商户前（§5）：将承运商 `carrier_cost`
 * 经加价规则转为商户可见 `sell_price`，原始成本保留用于对账与利润核算（§10.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { CargoType } from '../../carriers/dto/rate.dto'

/** 加价规则类型（§10.2） */
export enum MarkupRuleType {
  PERCENT = 'percent', // 按比例：cost × (1 + rate%)
  FIXED = 'fixed', // 固定加价：cost + 固定金额
  TIERED = 'tiered', // 阶梯加价：按重量段选 rate%（§10.2）
  MIN_MARGIN = 'min_margin', // 最低毛利保护：margin 绝对值下限（§10.2）
}

/** 加价规则作用域（§10.2，最具体者胜出） */
export enum MarkupScope {
  GLOBAL = 'global', // 全局默认
  CARRIER = 'carrier', // 按承运商
  PRODUCT = 'product', // 按服务产品
  ROUTE_ZONE = 'route_zone', // 按线路分区（待 §18 接入 zone_maps）
  TENANT = 'tenant', // 按租户（商户差异化定价 / 大客户折扣）
}

/** 规则参数（按 rule_type 形状不同，见各字段注释） */
export interface MarkupRuleParams {
  /** PERCENT：加价率（0.15 = 15%） */
  rate?: number
  /** FIXED：固定加价金额（金额币种见 rule.currency，默认基准币种） */
  amount?: number
  /** TIERED：重量段阶梯，逐段匹配 chargeableWeightKg，命中取 rate（兜底 defaultRate） */
  tiers?: Array<{ minWeightKg?: number; maxWeightKg?: number; rate: number }>
  /** TIERED：未命中任何段时的默认 rate */
  defaultRate?: number
  /** MIN_MARGIN：最低毛利绝对值（基准币种） */
  minAmount?: number
}

/** 单条加价规则（内存模型；待 §10.6 落 `markup_rules` 表） */
export interface MarkupRule {
  id?: string // 规则 ID（DB 持久化后；内存实例可缺省）
  tenantId?: string // 租户 ID（GLOBAL 规则为 undefined）
  scope: MarkupScope // 作用域
  scopeKey?: string // 作用域键值（如 carrierCode / productCode / zone / tenantId）
  ruleType: MarkupRuleType // 规则类型
  params: MarkupRuleParams // 规则参数
  currency?: string // 规则金额币种（默认平台基准币种，§10.3）
  priority: number // 优先级（同作用域冲突时大者胜出；叠加顺序按优先级升序）
  enabled?: boolean // 是否启用（默认 true）
}

/** 加价上下文（用于规则作用域匹配） */
export interface MarkupContext {
  tenantId: string // 租户 ID（商户差异化定价，§10.2）
  carrierCode: string // 承运商代码（CARRIER 作用域）
  productCode: string // 物流产品代码（PRODUCT 作用域）
  destCountry?: string // 目的国（ROUTE_ZONE 作用域，待 §18）
  cargoType?: CargoType // 货物类型
  chargeableWeightKg?: number // 计费重（TIERED 阶梯匹配，§10.2）
}

/** 汇率快照（落账审计，§10.6 rate_quotes.fx_rate_snapshot） */
export interface FxRateSnapshot {
  from: string // 原币种（ISO 4217）
  to: string // 目标币种（基准币种）
  rate: number // 汇率（from → to）
  effectiveAt?: string // 生效时间（UTC ISO）
}

/** 加价结果（双价列归一，§10.1） */
export interface MarkupResult {
  carrierCostBase: number // 承运商成本（已归一为基准币种）
  sellPrice: number // 商户可见售价（基准币种，已含加价）
  margin: number // 平台利润 = sellPrice − carrierCostBase
  marginPct: number // 利润率 = margin / sellPrice
  baseCurrency: string // 基准币种
  fxRate?: FxRateSnapshot // 币种归一所用汇率（原币≠基准币时存在）
  appliedRules: string[] // 实际命中的规则 ID/描述（便于排障与前端提示）
}
