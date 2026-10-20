/**
 * 风控前端接口（任务 5.1，方案 §26 风控体系）。
 * 类型与标签对齐后端 risk.types.ts / RiskService；对接 http.ts（演示/正式双路）。
 */
import http from './http'

/** 风险类别：欺诈/刷单 · 黑名单 · 敏感货瞒报 */
export type RiskCategory = 'fraud' | 'blacklist' | 'misdeclaration'
/** 风险等级：低 / 中 / 高 */
export type RiskLevel = 'low' | 'medium' | 'high'
/** 黑名单类型：地址 / 买家 / 支付 */
export type BlacklistType = 'address' | 'buyer' | 'payment'
/** 人工审核状态：待审 / 通过 / 驳回 / 自动放行 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'auto'

/** 单条命中明细 */
export interface RiskHit {
  ruleId: string
  ruleName: string
  category: RiskCategory
  scoreDelta: number
  detail: string
}

/** 风控规则 */
export interface RiskRule {
  id: string
  tenantId: string
  name: string
  category: RiskCategory
  description: string
  enabled: boolean
  score: number
  severity: RiskLevel
  createdAt: string
  updatedAt: string
}

/** 风险订单评分结果 */
export interface RiskOrderEvaluation {
  id: string
  tenantId: string
  orderId: string
  platformOrderNo: string
  recipientName: string
  country: string
  amount: number
  currency: string
  score: number
  level: RiskLevel
  hits: RiskHit[]
  blacklisted: boolean
  reviewStatus: ReviewStatus
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNote: string | null
  createdAt: string
}

/** 黑名单条目 */
export interface BlacklistEntry {
  id: string
  tenantId: string
  type: BlacklistType
  value: string
  reason: string
  createdAt: string
}

/** 风控总览 */
export interface RiskSummary {
  scanned: number
  highRisk: number
  pendingReview: number
  blacklistCount: number
  ruleCount: number
}

/** 新建规则入参 */
export interface CreateRiskRuleDto {
  name: string
  category: RiskCategory
  description?: string
  enabled?: boolean
  score?: number
  severity?: RiskLevel
}

/** 更新规则（启停开关等） */
export interface UpdateRiskRuleDto {
  name?: string
  category?: RiskCategory
  description?: string
  enabled?: boolean
  score?: number
  severity?: RiskLevel
}

/** 新增黑名单入参 */
export interface CreateBlacklistDto {
  type: BlacklistType
  value: string
  reason?: string
}

/** 人工审核决策 */
export interface ReviewDecisionDto {
  decision: 'approved' | 'rejected'
  note?: string
}

// ===== 标签（界面展示）=====

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  fraud: '欺诈/刷单',
  blacklist: '黑名单',
  misdeclaration: '敏感货瞒报',
}

export const RISK_CATEGORY_TAG: Record<RiskCategory, 'danger' | 'warning' | 'info'> = {
  fraud: 'danger',
  blacklist: 'warning',
  misdeclaration: 'info',
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

/** 风险等级标签类型（Element Plus el-tag type） */
export const RISK_LEVEL_TAG: Record<RiskLevel, 'success' | 'warning' | 'danger'> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
}

export const BLACKLIST_TYPE_LABELS: Record<BlacklistType, string> = {
  address: '地址',
  buyer: '买家',
  payment: '支付',
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: '待人工审核',
  approved: '审核通过',
  rejected: '审核驳回',
  auto: '自动放行',
}

export const REVIEW_STATUS_TAG: Record<ReviewStatus, 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  auto: 'info',
}

/** 风控接口封装（演示/正式双路，统一经 http.ts） */
export const riskApi = {
  /** 风控总览（四卡） */
  summary: () => http.get<RiskSummary>('/risk/summary'),
  /** 风险订单评分列表 */
  listOrders: () => http.get<RiskOrderEvaluation[]>('/risk/orders'),
  /** 风险订单详情 */
  getOrder: (id: string) => http.get<RiskOrderEvaluation>(`/risk/orders/${id}`),
  /** 人工审核 */
  reviewOrder: (id: string, dto: ReviewDecisionDto) =>
    http.post<RiskOrderEvaluation>(`/risk/orders/${id}/review`, dto),
  /** 规则引擎列表 */
  listRules: () => http.get<RiskRule[]>('/risk/rules'),
  /** 新建规则 */
  createRule: (dto: CreateRiskRuleDto) => http.post<RiskRule>('/risk/rules', dto),
  /** 更新规则（启停开关等） */
  updateRule: (id: string, dto: UpdateRiskRuleDto) =>
    http.patch<RiskRule>(`/risk/rules/${id}`, dto),
  /** 删除规则 */
  deleteRule: (id: string) => http.delete<{ deleted: boolean }>(`/risk/rules/${id}`),
  /** 黑名单列表 */
  listBlacklist: () => http.get<BlacklistEntry[]>('/risk/blacklist'),
  /** 新增黑名单 */
  addBlacklist: (dto: CreateBlacklistDto) => http.post<BlacklistEntry>('/risk/blacklist', dto),
  /** 移除黑名单 */
  removeBlacklist: (id: string) => http.delete<{ deleted: boolean }>(`/risk/blacklist/${id}`),
}

export default riskApi
