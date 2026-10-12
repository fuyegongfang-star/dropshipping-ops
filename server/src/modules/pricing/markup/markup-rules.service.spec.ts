/**
 * 加价规则解析单测（任务 3.6，方案 §10.2）。
 * 验证：默认规则载入、作用域匹配、同作用域最具体/高 priority 胜出、跨作用域叠加排序。
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import 'reflect-metadata'
import { MarkupRulesService } from './markup-rules.service'
import { MarkupContext, MarkupScope, MarkupRuleType } from './markup.types'

type StubLogger = { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

function ctx(over: Partial<MarkupContext> = {}): MarkupContext {
  return { tenantId: 't1', carrierCode: 'yunexpress', productCode: 'std', chargeableWeightKg: 1, ...over }
}

describe('MarkupRulesService (3.6 规则解析)', () => {
  let svc: MarkupRulesService
  beforeEach(() => {
    svc = new MarkupRulesService(stubLogger() as unknown as never)
  })

  it('默认载入全局 15% + 最低毛利 ¥5', () => {
    const rules = svc.resolveRules(ctx())
    const types = rules.map((r) => r.ruleType)
    expect(types).toContain(MarkupRuleType.PERCENT)
    expect(types).toContain(MarkupRuleType.MIN_MARGIN)
  })

  it('同作用域多条命中时高 priority 者胜出（仅保留一条）', () => {
    // 再注册一条 GLOBAL percent，priority 更低 → 应被默认(10)覆盖；更高 → 胜出
    svc.registerRule({ scope: MarkupScope.GLOBAL, ruleType: MarkupRuleType.PERCENT, params: { rate: 0.3 }, priority: 999 })
    const percentRules = svc.resolveRules(ctx()).filter((r) => r.ruleType === MarkupRuleType.PERCENT)
    expect(percentRules).toHaveLength(1) // 同作用域去重
    expect(percentRules[0].params.rate).toBe(0.3) // 高 priority 胜出
  })

  it('CARRIER 作用域规则与 GLOBAL 叠加（不同作用域共存）', () => {
    svc.registerRule({ scope: MarkupScope.CARRIER, scopeKey: 'yunexpress', ruleType: MarkupRuleType.PERCENT, params: { rate: 0.05 }, priority: 10 })
    const rules = svc.resolveRules(ctx({ carrierCode: 'yunexpress' }))
    // GLOBAL percent + GLOBAL min_margin + CARRIER percent = 3 条
    expect(rules.filter((r) => r.ruleType === MarkupRuleType.PERCENT)).toHaveLength(2)
  })

  it('CARRIER 规则仅对匹配承运商生效（其他承运商不命中）', () => {
    svc.registerRule({ scope: MarkupScope.CARRIER, scopeKey: 'dhl', ruleType: MarkupRuleType.PERCENT, params: { rate: 0.08 }, priority: 10 })
    const forDhl = svc.resolveRules(ctx({ carrierCode: 'dhl' })).some((r) => r.scopeKey === 'dhl')
    const forYun = svc.resolveRules(ctx({ carrierCode: 'yunexpress' })).some((r) => r.scopeKey === 'dhl')
    expect(forDhl).toBe(true)
    expect(forYun).toBe(false)
  })

  it('TENANT 私有规则不对其他租户泄漏', () => {
    svc.registerRule({ tenantId: 'vip', scope: MarkupScope.TENANT, scopeKey: 'vip', ruleType: MarkupRuleType.PERCENT, params: { rate: 0.02 }, priority: 10 })
    const vip = svc.resolveRules(ctx({ tenantId: 'vip' })).some((r) => r.scope === MarkupScope.TENANT)
    const other = svc.resolveRules(ctx({ tenantId: 't1' })).some((r) => r.scope === MarkupScope.TENANT)
    expect(vip).toBe(true)
    expect(other).toBe(false)
  })

  it('应用顺序按 specificity 升序（GLOBAL 先于 CARRIER）', () => {
    svc.registerRule({ scope: MarkupScope.CARRIER, scopeKey: 'yunexpress', ruleType: MarkupRuleType.FIXED, params: { amount: 3 }, priority: 10 })
    const rules = svc.resolveRules(ctx({ carrierCode: 'yunexpress' }))
    const order = rules.map((r) => r.scope)
    const globalIdx = order.indexOf(MarkupScope.GLOBAL)
    const carrierIdx = order.indexOf(MarkupScope.CARRIER)
    expect(globalIdx).toBeLessThan(carrierIdx)
  })
})
