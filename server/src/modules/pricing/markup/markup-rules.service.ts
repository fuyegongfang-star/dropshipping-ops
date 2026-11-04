/**
 * 加价规则解析服务（任务 3.6，方案 §10.2 加价规则引擎；任务 11.2 持久化到 markup_rules 表）。
 *
 * 职责：规则内存注册（待 §10.6 落 `markup_rules` 表）→ 11.2 已落库；按上下文（租户/承运商/产品/分区）
 * 解析适用规则，并做「跨作用域叠加 + 同作用域最具体者胜出」的排序。
 *
 * 设计（11.2）：
 * - **DB 为源、内存为运行期缓存**：markup_rules(source='engine') 是引擎默认规则的唯一真相源；
 *   onModuleInit 从 DB 载入内存，空则落库种子（幂等）；运行期 resolveRules 始终走内存，零 await，比价热路径不受影响；
 * - **优雅降级**：若 PostgreSQL 不可达（如沙箱无 PG），onModuleInit 捕获异常并保留构造函数种子，引擎照常工作；
 * - 租户隔离：引擎默认规则为平台级，写入 sentinel tenantId('__platform__')；markup_rules 属租户隔离模型，
 *   但本写入发生在启动时（无请求上下文），租户隔离中间件对其透明、不拦截。
 *
 * 负责人：夜间自动开发引擎 ｜ 新增 DB 持久化于 2026-11-04 夜间批次（11.2）
 */

import { Injectable, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AppLogger } from '../../../common/logger/app.logger'
import { PrismaService } from '../../../database/prisma.service'
import { MarkupContext, MarkupRule, MarkupRuleType, MarkupScope } from './markup.types'
import { MARKUP_BASE_CURRENCY } from './fx.service'

/** 引擎默认规则为平台级规则，不绑定真实租户；tenantId 存空串，scopeMatches 据此视为全局命中 */
const PLATFORM_TENANT = ''

/** 作用域具体度（大者更具体，应用更晚、同域内胜出） */
const SCOPE_SPEC: Record<MarkupScope, number> = {
  [MarkupScope.GLOBAL]: 1,
  [MarkupScope.ROUTE_ZONE]: 2,
  [MarkupScope.CARRIER]: 3,
  [MarkupScope.PRODUCT]: 4,
  [MarkupScope.TENANT]: 5,
}

@Injectable()
export class MarkupRulesService implements OnModuleInit {
  /** 内存规则表（运行期生效；由 DB 或构造函数种子填充） */
  private readonly rules: MarkupRule[] = []

  constructor(
    private readonly logger: AppLogger,
    private readonly prisma: PrismaService,
  ) {
    // 构造种子：即便 DB 不可达，引擎也能提供默认加价，保证可独立启动
    this.seedDefaults()
  }

  /** 服务启动：从 markup_rules(source='engine') 载入运行期缓存；空则落库种子（幂等）。DB 不可达则保留构造种子。 */
  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.prisma.markupRule.findMany({
        where: { source: 'engine' },
        orderBy: { priority: 'asc' },
      })
      if (rows.length === 0) {
        await this.seedToDb()
        this.logger.log('[Markup] markup_rules(engine) 为空，已落库引擎默认规则')
        // 重新载入刚写入的行，保证 id 一致
        const seeded = await this.prisma.markupRule.findMany({ where: { source: 'engine' }, orderBy: { priority: 'asc' } })
        this.rules.splice(0, this.rules.length, ...seeded.map((r) => this.toRule(r)))
      } else {
        this.rules.splice(0, this.rules.length, ...rows.map((r) => this.toRule(r)))
        this.logger.log(`[Markup] 已从 markup_rules 载入 ${rows.length} 条引擎规则到运行期缓存`)
      }
    } catch (err) {
      this.logger.warn(`[Markup] 从 markup_rules 载入失败，使用构造种子（${this.describe(err)}）`)
    }
  }

  /** 载入默认规则（演示口径，TODO §23 运营后台配置化） */
  private seedDefaults(): void {
    // 全局默认：成本 ×(1+15%) + 最低毛利保护 ¥5（小额运单防赔本）
    this.registerRule({
      scope: MarkupScope.GLOBAL,
      ruleType: MarkupRuleType.PERCENT,
      params: { rate: 0.15 },
      priority: 10,
      enabled: true,
    })
    this.registerRule({
      scope: MarkupScope.GLOBAL,
      ruleType: MarkupRuleType.MIN_MARGIN,
      params: { minAmount: 5 },
      priority: 100,
      enabled: true,
    })
    this.logger.debug('[Markup] 默认加价规则已载入：全局 15% + 最低毛利 ¥5')
  }

  /** 引擎默认规则落库（两条 GLOBAL 规则） */
  private async seedToDb(): Promise<void> {
    const defaults: MarkupRule[] = [
      { scope: MarkupScope.GLOBAL, ruleType: MarkupRuleType.PERCENT, params: { rate: 0.15 }, priority: 10, enabled: true },
      { scope: MarkupScope.GLOBAL, ruleType: MarkupRuleType.MIN_MARGIN, params: { minAmount: 5 }, priority: 100, enabled: true },
    ]
    for (const r of defaults) {
      const row = this.toRow(r)
      await this.prisma.markupRule.create({ data: row })
    }
  }

  /** 注册一条规则（内存；运营后台写入时走同一入口，TODO DB） */
  registerRule(rule: MarkupRule): void {
    this.rules.push({ id: rule.id ?? `mk_${this.rules.length + 1}`, enabled: true, ...rule })
  }

  /** 列出规则（可按租户过滤；仅用于运营后台/排障） */
  listRules(tenantId?: string): MarkupRule[] {
    return tenantId ? this.rules.filter((r) => r.tenantId === tenantId) : [...this.rules]
  }

  /** 单条规则是否命中上下文（作用域 + 键值 + 租户归属） */
  private scopeMatches(rule: MarkupRule, ctx: MarkupContext): boolean {
    if (rule.enabled === false) return false
    // 租户私有规则：仅对该租户生效（GLOBAL 无 tenantId，对所有租户生效）
    if (rule.tenantId && rule.tenantId !== ctx.tenantId) return false

    switch (rule.scope) {
      case MarkupScope.GLOBAL:
        return true // 无 scopeKey，对所有命中
      case MarkupScope.CARRIER:
        return rule.scopeKey === ctx.carrierCode
      case MarkupScope.PRODUCT:
        return rule.scopeKey === ctx.productCode
      case MarkupScope.TENANT:
        return rule.scopeKey === ctx.tenantId
      case MarkupScope.ROUTE_ZONE:
        // TODO(ops): 2026-11 接入 §18 zone_maps 后按 destCountry 映射 zone 再匹配 scopeKey
        return false
      default:
        return false
    }
  }

  /**
   * 解析上下文适用规则，按应用顺序返回（specificity 升序 → priority 升序）。
   * 同作用域多条命中时仅保留最具体/最高 priority 的一条（胜出）。
   */
  resolveRules(ctx: MarkupContext): MarkupRule[] {
    const matched = this.rules.filter((r) => this.scopeMatches(r, ctx))

    // 同（作用域 + 规则类型）去重：保留最高 priority 单条（不同 rule_type 的同作用域规则共存叠加，
    // 例如 GLOBAL percent 与 GLOBAL min_margin 都应生效；仅同型冲突时最具体/高优先级胜出）
    const byKey = new Map<string, MarkupRule>()
    for (const r of matched) {
      const key = `${r.scope}:${r.ruleType}`
      const cur = byKey.get(key)
      if (!cur || r.priority > cur.priority) byKey.set(key, r)
    }

    return Array.from(byKey.values()).sort(
      (a, b) => SCOPE_SPEC[a.scope] - SCOPE_SPEC[b.scope] || a.priority - b.priority,
    )
  }

  /** MarkupRule → DB 行（params 内嵌 scopeKey 以保留匹配键，便于重建） */
  private toRow(rule: MarkupRule): Prisma.MarkupRuleCreateInput {
    return {
      tenantId: PLATFORM_TENANT,
      scope: rule.scope,
      ruleType: rule.ruleType,
      params: { ...rule.params, scopeKey: rule.scopeKey } as unknown as Prisma.InputJsonValue,
      currency: rule.currency ?? MARKUP_BASE_CURRENCY,
      priority: rule.priority,
      enabled: rule.enabled ?? true,
      source: 'engine',
    }
  }

  /** DB 行 → MarkupRule（从 params 还原 scopeKey） */
  private toRule(row: {
    id: string
    tenantId: string
    scope: string
    ruleType: string
    params: Prisma.JsonValue
    currency: string
    priority: number
    enabled: boolean
  }): MarkupRule {
    const params = (row.params ?? {}) as MarkupRule['params'] & { scopeKey?: string }
    return {
      id: row.id,
      tenantId: row.tenantId,
      scope: row.scope as MarkupScope,
      scopeKey: params.scopeKey,
      ruleType: row.ruleType as MarkupRuleType,
      params,
      currency: row.currency,
      priority: row.priority,
      enabled: row.enabled,
    }
  }

  /** 截断错误描述，避免敏感堆栈外泄到日志 */
  private describe(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
  }
}
