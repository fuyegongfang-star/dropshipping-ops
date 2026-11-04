/**
 * MarkupRulesService 持久化单测（任务 11.2，方案 §10.2 / markup_rules 表）。
 * 用 mock PrismaService 验证：
 * ① onModuleInit 在 markup_rules(source='engine') 为空时落库引擎默认规则（2 条 GLOBAL）；
 * ② 非空时从 DB 载入运行期缓存，resolveRules 反映 DB 行；
 * ③ DB 不可达时优雅降级（保留构造种子，不抛启动异常）；
 * ④ 运行期 resolveRules 仍走内存，不触碰 DB（零 await）。
 * 不依赖真实数据库，可在沙箱内零网络运行。
 */

import 'reflect-metadata'
import { MarkupRulesService } from './markup-rules.service'
import { MarkupContext, MarkupRuleType } from './markup.types'
import { PrismaService } from '../../../database/prisma.service'

type StubLogger = { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

interface MockMarkupRule {
  findMany: jest.Mock
  create: jest.Mock
}

function buildMockPrisma(mr: MockMarkupRule) {
  return { prisma: { markupRule: mr } as unknown as PrismaService, markupRule: mr }
}

function ctx(over: Partial<MarkupContext> = {}): MarkupContext {
  return { tenantId: 't1', carrierCode: 'yunexpress', productCode: 'std', chargeableWeightKg: 1, ...over }
}

describe('MarkupRulesService 持久化 (11.2 markup_rules)', () => {
  it('onModuleInit：engine 规则为空时落库默认（GLOBAL percent + min_margin，source=engine）', async () => {
    const seeded: Array<Record<string, unknown>> = []
    const markupRule: MockMarkupRule = {
      // 初次查空 → 落库 → 重载时返回刚写入的两行（模拟 DB 往返）
      findMany: jest.fn().mockResolvedValueOnce([]).mockImplementation(async () => seeded),
      create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `r${seeded.length + 1}`, ...data }
        seeded.push(row)
        return row
      }),
    }
    const { prisma } = buildMockPrisma(markupRule)
    const svc = new MarkupRulesService(stubLogger() as unknown as never, prisma)
    await svc.onModuleInit()
    expect(markupRule.findMany).toHaveBeenCalledTimes(2) // 初次查空 + 落库后重载
    expect(markupRule.create).toHaveBeenCalledTimes(2)
    // 落库行带 source='engine'，平台级规则 tenantId 为空串（视为全局命中）
    const call = markupRule.create.mock.calls[0][0].data
    expect(call.source).toBe('engine')
    expect(call.tenantId).toBe('')
    expect(call.scope).toBe('global')
    // 运行期缓存已由 DB 行填充，resolveRules 仍可用
    const types = svc.resolveRules(ctx()).map((r) => r.ruleType)
    expect(types).toContain(MarkupRuleType.PERCENT)
    expect(types).toContain(MarkupRuleType.MIN_MARGIN)
  })

  it('onModuleInit：engine 规则非空时载入缓存，resolveRules 反映 DB 行（不重复落库）', async () => {
    const dbRows = [
      { id: 'r1', tenantId: '', scope: 'global', ruleType: 'percent', params: { rate: 0.2 }, currency: 'CNY', priority: 10, enabled: true, source: 'engine' },
      { id: 'r2', tenantId: '', scope: 'global', ruleType: 'min_margin', params: { minAmount: 8 }, currency: 'CNY', priority: 100, enabled: true, source: 'engine' },
    ]
    const markupRule: MockMarkupRule = { findMany: jest.fn().mockResolvedValueOnce(dbRows).mockResolvedValueOnce(dbRows), create: jest.fn() }
    const { prisma } = buildMockPrisma(markupRule)
    const svc = new MarkupRulesService(stubLogger() as unknown as never, prisma)
    await svc.onModuleInit()
    expect(markupRule.create).not.toHaveBeenCalled() // 非空不重复落库
    const percent = svc.resolveRules(ctx()).find((r) => r.ruleType === MarkupRuleType.PERCENT)
    expect(percent?.params.rate).toBe(0.2) // 反映 DB 行（0.2 而非默认 0.15）
  })

  it('onModuleInit：DB 不可达时优雅降级（保留构造种子，不抛异常）', async () => {
    const markupRule: MockMarkupRule = { findMany: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')), create: jest.fn() }
    const { prisma } = buildMockPrisma(markupRule)
    const logger = stubLogger()
    const svc = new MarkupRulesService(logger as unknown as never, prisma)
    await expect(svc.onModuleInit()).resolves.toBeUndefined() // 不抛
    expect(logger.warn).toHaveBeenCalled()
    // 构造种子仍可用（默认 0.15）
    const percent = svc.resolveRules(ctx()).find((r) => r.ruleType === MarkupRuleType.PERCENT)
    expect(percent?.params.rate).toBe(0.15)
  })

  it('运行期 resolveRules 走内存，不触碰 DB（零 await，热路径安全）', () => {
    const markupRule: MockMarkupRule = { findMany: jest.fn(), create: jest.fn() }
    const { prisma } = buildMockPrisma(markupRule)
    const svc = new MarkupRulesService(stubLogger() as unknown as never, prisma)
    // 未调用 onModuleInit，构造种子生效，resolveRules 不应触发 DB 查询
    expect(markupRule.findMany).not.toHaveBeenCalled()
    expect(svc.resolveRules(ctx()).map((r) => r.ruleType)).toEqual(
      expect.arrayContaining([MarkupRuleType.PERCENT, MarkupRuleType.MIN_MARGIN]),
    )
    expect(svc.resolveRules(ctx({ carrierCode: 'dhl' }))).toBeDefined()
  })
})
