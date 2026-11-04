/**
 * FxService 持久化单测（任务 11.2，方案 §10.3 / fx_rates 表）。
 * 用 mock PrismaService 验证：
 * ① onModuleInit 在 fx_rates 为空时落库种子、非空时载入内存缓存；
 * ② updateRate 写库 + 更新缓存（热路径立即生效）；
 * ③ DB 不可达时优雅降级（保留内存种子，不抛启动异常）；
 * ④ 热路径 getRate/toBase/listRates 仍走内存，不触碰 DB（零 await）。
 * 不依赖真实数据库，可在沙箱内零网络运行。
 */

import 'reflect-metadata'
import { FxService, MARKUP_BASE_CURRENCY } from './fx.service'
import { PrismaService } from '../../../database/prisma.service'

type StubLogger = { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

interface MockFxRate {
  findMany: jest.Mock
  upsert: jest.Mock
}

/** 构造 mock PrismaService（仅 fxRate 命名空间） */
function buildMockPrisma(fxRate: MockFxRate) {
  return { prisma: { fxRate } as unknown as PrismaService, fxRate }
}

describe('FxService 持久化 (11.2 fx_rates)', () => {
  it('onModuleInit：fx_rates 为空时落库种子（10 条 SEED_RATES 全部 upsert）', async () => {
    const fxRate: MockFxRate = { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue(undefined) }
    const { prisma } = buildMockPrisma(fxRate)
    const svc = new FxService(stubLogger() as unknown as never, prisma)
    await svc.onModuleInit()
    expect(fxRate.findMany).toHaveBeenCalledTimes(1)
    expect(fxRate.upsert).toHaveBeenCalledTimes(10) // SEED_RATES 长度
    // 种子写库带 from_to 唯一定位
    const call = fxRate.upsert.mock.calls[0][0]
    expect(call.where).toHaveProperty('from_to')
  })

  it('onModuleInit：fx_rates 非空时载入内存缓存，USD→CNY 命中落库汇率', async () => {
    const fxRate: MockFxRate = {
      findMany: jest.fn().mockResolvedValue([{ from: 'usd', to: 'cny', rate: '8.0' }]),
      upsert: jest.fn(),
    }
    const { prisma } = buildMockPrisma(fxRate)
    const svc = new FxService(stubLogger() as unknown as never, prisma)
    await svc.onModuleInit()
    expect(fxRate.upsert).not.toHaveBeenCalled() // 非空不重复落库
    // 内存缓存已被 DB 行覆盖（8.0 而非默认种子 7.2）
    expect(svc.toBase(100, 'USD', 'CNY').amount).toBeCloseTo(800, 5)
  })

  it('updateRate：写库 + 更新内存缓存，热路径立即生效', async () => {
    const fxRate: MockFxRate = { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue(undefined) }
    const { prisma } = buildMockPrisma(fxRate)
    const svc = new FxService(stubLogger() as unknown as never, prisma)
    await svc.onModuleInit()
    const res = await svc.updateRate('USD', 'CNY', 7.5)
    expect(res.rate).toBe(7.5)
    expect(fxRate.upsert).toHaveBeenCalled()
    // 内存缓存同步更新（无需再读 DB）
    fxRate.findMany.mockClear()
    expect(svc.toBase(100, 'USD', 'CNY').amount).toBeCloseTo(750, 5)
  })

  it('updateRate：负数汇率诚实拒绝（不写库）', async () => {
    const fxRate: MockFxRate = { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() }
    const { prisma } = buildMockPrisma(fxRate)
    const svc = new FxService(stubLogger() as unknown as never, prisma)
    await expect(svc.updateRate('USD', 'CNY', -1)).rejects.toThrow(/正数/)
    expect(fxRate.upsert).not.toHaveBeenCalled()
  })

  it('onModuleInit：DB 不可达时优雅降级（保留内存种子，不抛异常）', async () => {
    const fxRate: MockFxRate = { findMany: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')), upsert: jest.fn() }
    const { prisma } = buildMockPrisma(fxRate)
    const logger = stubLogger()
    const svc = new FxService(logger as unknown as never, prisma)
    await expect(svc.onModuleInit()).resolves.toBeUndefined() // 不抛
    expect(logger.warn).toHaveBeenCalled() // 记录降级告警
    // 内存种子仍可用（默认 7.2）
    expect(svc.toBase(100, 'USD', 'CNY').amount).toBeCloseTo(720, 5)
  })

  it('基准币种常量与内存热路径无关 DB', () => {
    expect(MARKUP_BASE_CURRENCY).toBe('CNY')
    const fxRate: MockFxRate = { findMany: jest.fn(), upsert: jest.fn() }
    const { prisma } = buildMockPrisma(fxRate)
    const svc = new FxService(stubLogger() as unknown as never, prisma)
    // 未调用 onModuleInit 时，构造种子已生效，getRate 不触碰 DB
    expect(fxRate.findMany).not.toHaveBeenCalled()
    expect(svc.toBase(100, 'CNY', 'CNY').amount).toBe(100)
  })
})
