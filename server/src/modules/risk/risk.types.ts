import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 风控体系类型与 DTO（任务 5.1，方案 §26 风控体系）。
 *
 * 覆盖三类风险：欺诈/刷单（fraud）、黑名单命中（blacklist）、敏感货瞒报（misdeclaration）。
 * 实现形态为「规则引擎 + 评分」：每条规则给出一个风险分值，命中后累加得到订单风险分，
 * 再按阈值映射为 低/中/高 风险等级；高风险（或命中黑名单）转人工审核（结合 §13 待审）。
 *
 * 字段形状对齐 Prisma `RiskRule / Blacklist / RiskEvaluation` 模型（见 schema.prisma），
 * 当前为内存实现（演示口径 + 单测可跑），TODO(platform): 2026-11 接入持久化。
 */

/** 风险类别：欺诈/刷单 · 黑名单 · 敏感货瞒报（§26） */
export type RiskCategory = 'fraud' | 'blacklist' | 'misdeclaration'

/** 风险等级：低 / 中 / 高（按累计评分阈值映射，命中黑名单直接判高） */
export type RiskLevel = 'low' | 'medium' | 'high'

/** 规则引擎：一条规则对应一类风险信号与其分值权重 */
export interface RiskRule {
  id: string
  tenantId: string
  name: string
  /** 规则归属的风险类别（§26 三大类） */
  category: RiskCategory
  /** 规则说明：触发条件的人话描述 */
  description: string
  /** 是否启用（停用规则不参与评分） */
  enabled: boolean
  /** 命中该规则累加的风险分值（0-100） */
  score: number
  /** 严重度标签（仅用于展示与排序，不影响评分） */
  severity: RiskLevel
  createdAt: string
  updatedAt: string
}

/** 单条命中明细（评分结果中展开展示） */
export interface RiskHit {
  ruleId: string
  ruleName: string
  category: RiskCategory
  /** 本次命中累加的分值 */
  scoreDelta: number
  /** 命中原因/证据说明 */
  detail: string
}

/** 单笔订单的风险评分结果（§26 规则引擎 + 评分输出） */
export interface RiskOrderEvaluation {
  id: string
  tenantId: string
  /** 关联订单/平台单号（演示态与订单中心单号同形） */
  orderId: string
  platformOrderNo: string
  recipientName: string
  country: string
  /** 订单金额（基准币 CNY） */
  amount: number
  currency: string
  /** 累计风险评分（所有命中规则 score 之和） */
  score: number
  /** 风险等级：low / medium / high */
  level: RiskLevel
  /** 命中的规则明细 */
  hits: RiskHit[]
  /** 是否命中黑名单（地址/买家/支付任一类） */
  blacklisted: boolean
  /** 人工审核状态：pending 待审 / approved 通过 / rejected 驳回 / auto 自动放行 */
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'auto'
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNote: string | null
  createdAt: string
}

/** 黑名单类型：地址 / 买家 / 支付（§26 黑名单） */
export type BlacklistType = 'address' | 'buyer' | 'payment'

/** 黑名单条目（地址/买家/支付任一类，命中即高风险） */
export interface BlacklistEntry {
  id: string
  tenantId: string
  type: BlacklistType
  /** 黑名单值：地址归一串 / 买家标识(邮箱或姓名) / 支付账户 */
  value: string
  /** 拉黑原因 */
  reason: string
  createdAt: string
}

/** 风控总览（页面顶部四卡） */
export interface RiskSummary {
  /** 已扫描订单数 */
  scanned: number
  /** 高风险订单数 */
  highRisk: number
  /** 待人工审核数 */
  pendingReview: number
  /** 生效黑名单条目数 */
  blacklistCount: number
  /** 生效规则数 */
  ruleCount: number
}

/** 新建规则入参（名称/类别必填，分值默认 30） */
export class CreateRiskRuleDto {
  @IsString()
  @MaxLength(80)
  name!: string

  @IsEnum(['fraud', 'blacklist', 'misdeclaration'])
  category!: RiskCategory

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  /** 分值：0-100，演示态按整数累加 */
  @IsOptional()
  score?: number

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  severity?: RiskLevel
}

/** 更新规则（整条覆盖式，仅接受传入字段；常用于启停开关） */
export class UpdateRiskRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string

  @IsOptional()
  @IsEnum(['fraud', 'blacklist', 'misdeclaration'])
  category?: RiskCategory

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  score?: number

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  severity?: RiskLevel
}

/** 新增黑名单入参（类型/值必填） */
export class CreateBlacklistDto {
  @IsEnum(['address', 'buyer', 'payment'])
  type!: BlacklistType

  @IsString()
  @MaxLength(200)
  value!: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}

/** 人工审核决策（§26 高风险转人工，结合 §13 待审） */
export class ReviewDecisionDto {
  @IsEnum(['approved', 'rejected'])
  decision!: 'approved' | 'rejected'

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string
}
