import { Injectable, NotFoundException } from '@nestjs/common'
import {
  BlacklistEntry,
  BlacklistType,
  CreateBlacklistDto,
  CreateRiskRuleDto,
  RiskCategory,
  RiskHit,
  RiskLevel,
  RiskOrderEvaluation,
  RiskRule,
  RiskSummary,
  ReviewDecisionDto,
  UpdateRiskRuleDto,
} from './risk.types'

/**
 * 风控服务（任务 5.1，方案 §26 风控体系）。
 *
 * 实现「规则引擎 + 评分」：
 *  - 规则（RiskRule）按类别（欺诈/黑名单/敏感货瞒报）分组，每条带分值权重。
 *  - 评分（evaluateRisk）：对单笔订单跑全部「启用中」规则，命中累加风险分，
 *    按阈值映射为 低/中/高；命中黑名单直接判高（§26 黑名单优先级最高）。
 *  - 高风险（或黑名单命中）→ reviewStatus=pending 转人工审核（结合 §13 待审）。
 *
 * 当前为内存实现（演示口径 + 单测可跑）；TODO(platform): 2026-11 接入 Prisma
 * `RiskRule / Blacklist / RiskEvaluation` 模型持久化（字段已对齐 schema.prisma）。
 */

/** 评分阈值：>=60 高，>=30 中，否则低（命中黑名单直接高）。 */
const HIGH_THRESHOLD = 60
const MEDIUM_THRESHOLD = 30

/** 欺诈规则触发阈值（演示口径，生产按租户可调） */
const FREQ_ORDER_THRESHOLD = 3 // 近窗口同买家下单频次 >= 3 视为异常
const LARGE_AMOUNT_THRESHOLD = 5000 // 单笔金额(CNY) > 5000 视为大额异常
const SAME_ADDRESS_THRESHOLD = 2 // 同地址订单数 >= 2 视为同地址多单

/**
 * 风险信号（evaluateRisk 的输入）：业务侧在落单/履约前算好的可解释信号。
 * 真实环境由订单中心/轨迹/抽检系统注入；演示态由种子订单直接给出。
 */
export interface RiskSignal {
  amount: number
  currency: string
  /** 同地址历史订单数（含本单） */
  sameAddressCount: number
  /** 近窗口同买家下单频次 */
  recentOrderCount: number
  /** 是否检出虚假轨迹 */
  trackingAnomaly: boolean
  /** 申报品类 */
  declaredCategory: string
  /** 实际品类（抽检/拦截得到） */
  actualCategory: string
  /** 已命中的黑名单项（地址/买家/支付） */
  blacklistHits: { type: BlacklistType; value: string }[]
}

@Injectable()
export class RiskService {
  private ruleSeq = 0
  private blacklistSeq = 0
  private orderSeq = 0

  /** 风控规则种子（三大类，分值权重可解释；blacklist 规则控制黑名单评分） */
  private readonly rules: RiskRule[] = [
    this.rule('高频下单异常', 'fraud', '近窗口同买家下单频次过高，疑似刷单', 40, 'high'),
    this.rule('大额订单异常', 'fraud', '单笔金额远超常规客单，疑似欺诈/洗钱', 25, 'medium'),
    this.rule('同地址多单', 'fraud', '同一收货地址短期内多笔订单，疑似拆单/刷单', 30, 'medium'),
    this.rule('虚假轨迹', 'fraud', '轨迹异常（无揽收/伪造节点），疑似虚假发货', 50, 'high'),
    this.rule('黑名单命中', 'blacklist', '命中地址/买家/支付黑名单，直接判高风险', 60, 'high'),
    this.rule('敏感货瞒报', 'misdeclaration', '申报品类与实际品类不符，疑似敏感货瞒报', 35, 'high'),
  ]

  /** 黑名单种子（演示态：地址/买家/支付各一） */
  private readonly blacklist: BlacklistEntry[] = [
    this.blEntry('address', 'US|90001|123 MAIN ST|JOHN DOE', '该地址历史多起丢件与拒收'),
    this.blEntry('buyer', 'fraud-buyer@risk.test', '买家账户关联多起退款欺诈'),
    this.blEntry('payment', 'CARD-****6621', '支付卡命中盗刷黑名单'),
  ]

  /** 风险订单种子：覆盖低/中/高与各类命中，演示评分与人工审核流 */
  private readonly orders: RiskOrderEvaluation[] = this.buildSeedOrders()

  // ===== 规则 CRUD =====

  /** 规则列表：按租户隔离。 */
  listRules(tenantId: string): RiskRule[] {
    return this.rules
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((r) => ({ ...r }))
  }

  createRule(tenantId: string, dto: CreateRiskRuleDto): RiskRule {
    const now = new Date().toISOString()
    const rule: RiskRule = {
      id: 'rr_' + Date.now().toString(36) + '_' + ++this.ruleSeq,
      tenantId,
      name: dto.name,
      category: dto.category,
      description: dto.description ?? '',
      enabled: dto.enabled ?? true,
      score: this.clampScore(dto.score ?? 30),
      severity: dto.severity ?? 'medium',
      createdAt: now,
      updatedAt: now,
    }
    this.rules.push(rule)
    return { ...rule }
  }

  updateRule(tenantId: string, id: string, dto: UpdateRiskRuleDto): RiskRule {
    const r = this.requireRule(tenantId, id)
    if (dto.name !== undefined) r.name = dto.name
    if (dto.category !== undefined) r.category = dto.category
    if (dto.description !== undefined) r.description = dto.description
    if (dto.enabled !== undefined) r.enabled = dto.enabled
    if (dto.score !== undefined) r.score = this.clampScore(dto.score)
    if (dto.severity !== undefined) r.severity = dto.severity
    r.updatedAt = new Date().toISOString()
    return { ...r }
  }

  deleteRule(tenantId: string, id: string): { deleted: boolean } {
    const idx = this.rules.findIndex((r) => r.id === id && r.tenantId === tenantId)
    if (idx < 0) throw new NotFoundException('风控规则不存在')
    this.rules.splice(idx, 1)
    return { deleted: true }
  }

  // ===== 黑名单 CRUD =====

  listBlacklist(tenantId: string): BlacklistEntry[] {
    return this.blacklist
      .filter((b) => b.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((b) => ({ ...b }))
  }

  addBlacklist(tenantId: string, dto: CreateBlacklistDto): BlacklistEntry {
    const entry: BlacklistEntry = {
      id: 'bl_' + Date.now().toString(36) + '_' + ++this.blacklistSeq,
      tenantId,
      type: dto.type,
      value: dto.value,
      reason: dto.reason ?? '',
      createdAt: new Date().toISOString(),
    }
    this.blacklist.push(entry)
    return { ...entry }
  }

  removeBlacklist(tenantId: string, id: string): { deleted: boolean } {
    const idx = this.blacklist.findIndex((b) => b.id === id && b.tenantId === tenantId)
    if (idx < 0) throw new NotFoundException('黑名单条目不存在')
    this.blacklist.splice(idx, 1)
    return { deleted: true }
  }

  // ===== 风险评分（§26 规则引擎 + 评分）=====

  /** 对单笔订单运行规则引擎，返回风险评分明细。
   *  - 仅统计「启用中」规则；命中累加 score。
   *  - 命中黑名单（blacklistHits 非空）时，套用 blacklist 类规则计高分并强制判高。
   *  - 敏感货瞒报：申报品类与实际品类不符且实际为敏感类时命中。 */
  evaluateRisk(tenantId: string, signal: RiskSignal): { score: number; level: RiskLevel; hits: RiskHit[] } {
    const hits: RiskHit[] = []
    let score = 0
    const active = this.rules.filter((r) => r.tenantId === tenantId && r.enabled)

    for (const r of active) {
      let hit = false
      let detail = ''
      switch (r.category) {
        case 'fraud':
          if (r.name === '高频下单异常' && signal.recentOrderCount >= FREQ_ORDER_THRESHOLD) {
            hit = true
            detail = `近窗口同买家下单 ${signal.recentOrderCount} 笔（阈值 ${FREQ_ORDER_THRESHOLD}）`
          } else if (r.name === '大额订单异常' && signal.amount > LARGE_AMOUNT_THRESHOLD) {
            hit = true
            detail = `单笔金额 ${signal.currency} ${signal.amount} 超阈值 ${LARGE_AMOUNT_THRESHOLD} CNY`
          } else if (r.name === '同地址多单' && signal.sameAddressCount >= SAME_ADDRESS_THRESHOLD) {
            hit = true
            detail = `同地址订单 ${signal.sameAddressCount} 笔（阈值 ${SAME_ADDRESS_THRESHOLD}）`
          } else if (r.name === '虚假轨迹' && signal.trackingAnomaly) {
            hit = true
            detail = '轨迹检出虚假节点/无揽收'
          }
          break
        case 'misdeclaration':
          if (r.name === '敏感货瞒报' && signal.actualCategory !== signal.declaredCategory) {
            hit = true
            detail = `申报「${signal.declaredCategory}」实际为「${signal.actualCategory}」`
          }
          break
        case 'blacklist':
          // 黑名单命中：blacklistHits 非空即视为命中，detail 列出命中项
          if (signal.blacklistHits.length > 0) {
            hit = true
            detail = signal.blacklistHits.map((h) => `${h.type}:${h.value}`).join('；')
          }
          break
      }
      if (hit) {
        score += r.score
        hits.push({ ruleId: r.id, ruleName: r.name, category: r.category, scoreDelta: r.score, detail })
      }
    }

    const blacklisted = signal.blacklistHits.length > 0
    const level = this.toLevel(score, blacklisted)
    return { score, level, hits }
  }

  /** 已扫描订单列表（含评分/等级/审核状态），按租户隔离。 */
  listOrders(tenantId: string): RiskOrderEvaluation[] {
    return this.orders
      .filter((o) => o.tenantId === tenantId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((o) => ({ ...o, hits: o.hits.map((h) => ({ ...h })) }))
  }

  getOrder(tenantId: string, id: string): RiskOrderEvaluation {
    return this.requireOrder(tenantId, id)
  }

  /** 人工审核决策（§26 高风险转人工，结合 §13 待审）。 */
  reviewOrder(tenantId: string, id: string, dto: ReviewDecisionDto): RiskOrderEvaluation {
    const o = this.requireOrder(tenantId, id)
    o.reviewStatus = dto.decision
    o.reviewedBy = 'risk_operator'
    o.reviewNote = dto.note ?? null
    o.reviewedAt = new Date().toISOString()
    return { ...o, hits: o.hits.map((h) => ({ ...h })) }
  }

  /** 风控总览（页面四卡）。 */
  summary(tenantId: string): RiskSummary {
    const orders = this.orders.filter((o) => o.tenantId === tenantId)
    return {
      scanned: orders.length,
      highRisk: orders.filter((o) => o.level === 'high').length,
      pendingReview: orders.filter((o) => o.reviewStatus === 'pending').length,
      blacklistCount: this.blacklist.filter((b) => b.tenantId === tenantId).length,
      ruleCount: this.rules.filter((r) => r.tenantId === tenantId && r.enabled).length,
    }
  }

  // ===== 内部辅助 =====

  private toLevel(score: number, blacklisted: boolean): RiskLevel {
    if (blacklisted || score >= HIGH_THRESHOLD) return 'high'
    if (score >= MEDIUM_THRESHOLD) return 'medium'
    return 'low'
  }

  private clampScore(v: number): number {
    if (!Number.isFinite(v) || v < 0) return 0
    return Math.min(100, Math.trunc(v))
  }

  private rule(name: string, category: RiskCategory, description: string, score: number, severity: RiskLevel): RiskRule {
    const now = new Date().toISOString()
    return {
      id: 'rr_seed_' + ++this.ruleSeq,
      tenantId: 't_demo',
      name,
      category,
      description,
      enabled: true,
      score,
      severity,
      createdAt: now,
      updatedAt: now,
    }
  }

  private blEntry(type: BlacklistType, value: string, reason: string): BlacklistEntry {
    return {
      id: 'bl_seed_' + ++this.blacklistSeq,
      tenantId: 't_demo',
      type,
      value,
      reason,
      createdAt: new Date().toISOString(),
    }
  }

  /** 构造风险订单种子：覆盖低/中/高与各类命中，演示评分与人工审核流转。 */
  private buildSeedOrders(): RiskOrderEvaluation[] {
    const tenantId = 't_demo'
    type Seed = {
      platformOrderNo: string
      recipientName: string
      country: string
      amount: number
      currency: string
      signal: RiskSignal
      createdAt: string
    }
    const seeds: Seed[] = [
      {
        // 干净订单：无命中 → 低
        platformOrderNo: 'SO-30001',
        recipientName: 'Alice Wang',
        country: 'US',
        amount: 199.0,
        currency: 'USD',
        signal: this.sig({ amount: 199, currency: 'USD', sameAddressCount: 1, recentOrderCount: 1, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [] }),
        createdAt: '2026-10-11T09:00:00.000Z',
      },
      {
        // 同地址多单(3) + 高频下单(3) → 70 分高（pending）
        platformOrderNo: 'SO-30002',
        recipientName: 'Bob Li',
        country: 'US',
        amount: 268.0,
        currency: 'USD',
        signal: this.sig({ amount: 268, currency: 'USD', sameAddressCount: 3, recentOrderCount: 3, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [] }),
        createdAt: '2026-10-12T10:00:00.000Z',
      },
      {
        // 虚假轨迹 → 50 分中（自动放行）
        platformOrderNo: 'AMZ-30003',
        recipientName: 'Carol Chen',
        country: 'DE',
        amount: 320.0,
        currency: 'EUR',
        signal: this.sig({ amount: 320, currency: 'EUR', sameAddressCount: 1, recentOrderCount: 1, trackingAnomaly: true, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [] }),
        createdAt: '2026-10-13T11:00:00.000Z',
      },
      {
        // 命中黑名单（地址）→ 高（pending，强制判高）
        platformOrderNo: 'SO-30004',
        recipientName: 'John Doe',
        country: 'US',
        amount: 159.0,
        currency: 'USD',
        signal: this.sig({ amount: 159, currency: 'USD', sameAddressCount: 1, recentOrderCount: 1, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [{ type: 'address', value: 'US|90001|123 MAIN ST|JOHN DOE' }] }),
        createdAt: '2026-10-14T12:00:00.000Z',
      },
      {
        // 敏感货瞒报（申报 normal 实际 battery）+ 同地址多单 → 高（pending）
        platformOrderNo: 'SO-30005',
        recipientName: 'David Zhao',
        country: 'GB',
        amount: 420.0,
        currency: 'GBP',
        signal: this.sig({ amount: 420, currency: 'GBP', sameAddressCount: 2, recentOrderCount: 2, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'battery', blacklistHits: [] }),
        createdAt: '2026-10-15T13:00:00.000Z',
      },
      {
        // 大额异常(>5000 CNY)+ 同地址多单 → 55 分中（自动放行）
        platformOrderNo: 'AMZ-30006',
        recipientName: 'Eva Sun',
        country: 'US',
        amount: 980.0,
        currency: 'USD',
        signal: this.sig({ amount: 980, currency: 'USD', sameAddressCount: 2, recentOrderCount: 2, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [] }),
        createdAt: '2026-10-16T14:00:00.000Z',
      },
      {
        // 命中支付黑名单 + 大额 → 高（pending）
        platformOrderNo: 'SO-30007',
        recipientName: 'Frank Wu',
        country: 'FR',
        amount: 540.0,
        currency: 'EUR',
        signal: this.sig({ amount: 540, currency: 'EUR', sameAddressCount: 1, recentOrderCount: 1, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [{ type: 'payment', value: 'CARD-****6621' }] }),
        createdAt: '2026-10-17T15:00:00.000Z',
      },
      {
        // 仅同地址多单(2) → 中（自动放行）
        platformOrderNo: 'SO-30008',
        recipientName: 'Grace Liu',
        country: 'CA',
        amount: 88.0,
        currency: 'USD',
        signal: this.sig({ amount: 88, currency: 'USD', sameAddressCount: 2, recentOrderCount: 2, trackingAnomaly: false, declaredCategory: 'normal', actualCategory: 'normal', blacklistHits: [] }),
        createdAt: '2026-10-18T16:00:00.000Z',
      },
    ]

    return seeds.map((s, i) => {
      const { score, level, hits } = this.evaluateRisk(tenantId, s.signal)
      const reviewStatus: RiskOrderEvaluation['reviewStatus'] =
        level === 'high' ? 'pending' : 'auto'
      return {
        id: 'rk_seed_' + (i + 1),
        tenantId,
        orderId: 'o_risk_' + (i + 1),
        platformOrderNo: s.platformOrderNo,
        recipientName: s.recipientName,
        country: s.country,
        amount: s.amount,
        currency: s.currency,
        score,
        level,
        hits,
        blacklisted: s.signal.blacklistHits.length > 0,
        reviewStatus,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        createdAt: s.createdAt,
      }
    })
  }

  /** 便捷构造 RiskSignal（仅填差异项，默认值兜底）。 */
  private sig(p: Partial<RiskSignal> & { amount: number; currency: string }): RiskSignal {
    return {
      amount: p.amount,
      currency: p.currency,
      sameAddressCount: p.sameAddressCount ?? 1,
      recentOrderCount: p.recentOrderCount ?? 1,
      trackingAnomaly: p.trackingAnomaly ?? false,
      declaredCategory: p.declaredCategory ?? 'normal',
      actualCategory: p.actualCategory ?? 'normal',
      blacklistHits: p.blacklistHits ?? [],
    }
  }

  private requireRule(tenantId: string, id: string): RiskRule {
    const r = this.rules.find((x) => x.id === id && x.tenantId === tenantId)
    if (!r) throw new NotFoundException('风控规则不存在')
    return r
  }

  private requireOrder(tenantId: string, id: string): RiskOrderEvaluation {
    const o = this.orders.find((x) => x.id === id && x.tenantId === tenantId)
    if (!o) throw new NotFoundException('风险订单不存在')
    return { ...o, hits: o.hits.map((h) => ({ ...h })) }
  }
}
