/**
 * 加价规则解析服务（任务 3.6，方案 §10.2 加价规则引擎）。
 * 负责：规则内存注册（待 §10.6 落 `markup_rules` 表）、按上下文（租户/承运商/产品/分区）
 * 解析适用规则，并做「跨作用域叠加 + 同作用域最具体者胜出」的排序。
 *
 * 冲突策略（诚实、可解释，待 §23 运营后台显式配置）：
 *   - 不同作用域的规则**叠加**（GLOBAL 默认 + CARRIER/PRODUCT/TENANT 维度各自生效）；
 *   - 同一作用域内命中多条时，**最具体（高 specificity）/ 高 priority 者胜出**，其余丢弃；
 *   - 应用顺序按 specificity 升序（GLOBAL → ROUTE_ZONE → CARRIER → PRODUCT → TENANT），
 *     更具体的规则后生效，可修正综合效果。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../../common/logger/app.logger'
import { MarkupContext, MarkupRule, MarkupRuleType, MarkupScope } from './markup.types'

/** 作用域具体度（大者更具体，应用更晚、同域内胜出） */
const SCOPE_SPEC: Record<MarkupScope, number> = {
  [MarkupScope.GLOBAL]: 1,
  [MarkupScope.ROUTE_ZONE]: 2,
  [MarkupScope.CARRIER]: 3,
  [MarkupScope.PRODUCT]: 4,
  [MarkupScope.TENANT]: 5,
}

@Injectable()
export class MarkupRulesService {
  /** 内存规则表（待 §10.6 持久化 markup_rules） */
  private readonly rules: MarkupRule[] = []

  constructor(private readonly logger: AppLogger) {
    this.seedDefaults()
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
}
