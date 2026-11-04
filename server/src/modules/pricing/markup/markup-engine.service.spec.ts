/**
 * 加价引擎单测（任务 3.6，方案 §10 双价列 / 加价层 / 币种归一）。
 * 验证：币种归一 → 加价叠加（PERCENT/FIXED/TIERED）→ 最低毛利保护 → 双价列产出。
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import 'reflect-metadata'
import { FxService } from './fx.service'
import { MarkupRulesService } from './markup-rules.service'
import { MarkupEngineService } from './markup-engine.service'
import { RateQuote } from '../../carriers/dto/rate.dto'
import { MarkupScope, MarkupRuleType } from './markup.types'
import { PrismaService } from '../../../database/prisma.service'

type StubLogger = { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

/** 空 mock PrismaService（markup 引擎单测不调用 onModuleInit，无需真实 DB） */
function stubPrisma(): PrismaService {
  return {
    fxRate: { findMany: jest.fn(), upsert: jest.fn().mockResolvedValue(undefined) },
    markupRule: { findMany: jest.fn(), create: jest.fn().mockResolvedValue(undefined) },
  } as unknown as PrismaService
}

function quote(over: Partial<RateQuote> = {}): RateQuote {
  return {
    carrierCode: 'yunexpress',
    productCode: 'std',
    productName: '云途-标准',
    chargeableWeightKg: 1,
    volumetricWeightKg: 1,
    isVolumetric: false,
    currency: 'USD',
    carrierCost: 100,
    reachable: true,
    ...over,
  }
}

describe('MarkupEngineService (3.6 加价引擎)', () => {
  let fx: FxService
  let rules: MarkupRulesService
  let svc: MarkupEngineService
  beforeEach(() => {
    fx = new FxService(stubLogger() as unknown as never, stubPrisma())
    rules = new MarkupRulesService(stubLogger() as unknown as never, stubPrisma())
    svc = new MarkupEngineService(fx, rules, stubLogger() as unknown as never)
  })

  it('币种归一 + 全局 15% 加价 + 最低毛利（利润充足不触发兜底）', () => {
    // carrierCost 100 USD → 720 CNY；×1.15 = 828；margin 108 ≥ 5 → 不兜底
    const r = svc.apply('t1', quote({ carrierCost: 100, currency: 'USD' }))
    expect(r.carrierCostBase).toBeCloseTo(720, 2)
    expect(r.sellPrice).toBeCloseTo(828, 2)
    expect(r.margin).toBeCloseTo(108, 2)
    expect(r.marginPct).toBeCloseTo(0.1304, 4)
    expect(r.baseCurrency).toBe('CNY')
    expect(r.fxRate).toEqual({ from: 'USD', to: 'CNY', rate: 7.2, effectiveAt: expect.any(String) })
  })

  it('最低毛利保护（§10.2）：小单利润不足时抬高到下限', () => {
    // 100 CNY → ×1.15 = 115；margin 15? 不, carrierCostBase=100 → 115, margin15 ≥5 不触发。
    // 用更低成本：carrierCost 10 CNY → ×1.15 = 11.5；margin 1.5 < 5 → 兜底到 15
    const r = svc.apply('t1', quote({ carrierCost: 10, currency: 'CNY' }))
    expect(r.carrierCostBase).toBeCloseTo(10, 2)
    expect(r.sellPrice).toBeCloseTo(15, 2) // 10 + 最低毛利 5
    expect(r.margin).toBeCloseTo(5, 2)
  })

  it('FIXED 固定加价与 PERCENT 叠加', () => {
    rules.registerRule({ scope: MarkupScope.GLOBAL, ruleType: MarkupRuleType.FIXED, params: { amount: 10 }, priority: 50 })
    // 720 × 1.15 = 828 + 10 = 838；min_margin 5 不触发
    const r = svc.apply('t1', quote({ carrierCost: 100, currency: 'USD' }))
    expect(r.sellPrice).toBeCloseTo(838, 2)
  })

  it('TIERED 阶梯：重货取更高 rate', () => {
    rules.registerRule({
      scope: MarkupScope.GLOBAL,
      ruleType: MarkupRuleType.TIERED,
      params: { tiers: [{ maxWeightKg: 2, rate: 0.1 }, { minWeightKg: 2, rate: 0.25 }], defaultRate: 0.2 },
      priority: 60,
    })
    const light = svc.apply('t1', quote({ carrierCost: 100, currency: 'CNY', chargeableWeightKg: 1 })) // ×1.1
    const heavy = svc.apply('t1', quote({ carrierCost: 100, currency: 'CNY', chargeableWeightKg: 5 })) // ×1.25
    expect(light.sellPrice).toBeCloseTo(100 * 1.15 * 1.1, 2)
    expect(heavy.sellPrice).toBeCloseTo(100 * 1.15 * 1.25, 2)
    expect(heavy.sellPrice).toBeGreaterThan(light.sellPrice)
  })

  it('CARRIER 维度叠加：全局 + 承运商各自生效', () => {
    rules.registerRule({ scope: MarkupScope.CARRIER, scopeKey: 'yunexpress', ruleType: MarkupRuleType.PERCENT, params: { rate: 0.05 }, priority: 10 })
    // 100 CNY：全局 ×1.15 再 ×1.05 = 120.75
    const r = svc.apply('t1', quote({ carrierCost: 100, currency: 'CNY', carrierCode: 'yunexpress' }))
    expect(r.sellPrice).toBeCloseTo(120.75, 2)
    expect(r.appliedRules.length).toBeGreaterThanOrEqual(2)
  })

  it('enrichQuotes 回填 RateQuote 双价列', () => {
    const out = svc.enrichQuotes('t1', [quote({ carrierCost: 100, currency: 'USD' })])
    expect(out[0].sellPrice).toBeCloseTo(828, 2)
    expect(out[0].margin).toBeCloseTo(108, 2)
    expect(out[0].currency).toBe('CNY')
    expect(out[0].fxRateSnapshot).toBeDefined()
  })
})
