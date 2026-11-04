/**
 * 试算单服务单测（任务 3.7 → 11.2 持久化到 quotes 表）。
 * 验证：创建落库 + quote_id、租户隔离、过期校验、渠道自选（仅列表内产品）、锁定价随自选刷新。
 * 用 mock PrismaService 驱动，不依赖真实数据库，可在沙箱内零网络运行。
 * 负责人：夜间自动开发引擎 ｜ 持久化改造于 2026-11-04 夜间批次（11.2）
 */

import 'reflect-metadata'
import { QuotesService } from './quotes.service'
import { QuoteStatus } from './quote.types'
import { CompareRequest } from '../pricing.types'
import { RateQuote } from '../../carriers/dto/rate.dto'
import { PrismaService } from '../../../database/prisma.service'

type StubLogger = { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

function req(): CompareRequest {
  return { destCountry: 'US', parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }] }
}

function results(): RateQuote[] {
  return [
    { carrierCode: 'yunexpress', productCode: 'std', productName: '云途-标准', chargeableWeightKg: 1, volumetricWeightKg: 1, isVolumetric: false, currency: 'CNY', carrierCost: 100, sellPrice: 115, margin: 15, reachable: true },
    { carrierCode: 'dhl', productCode: 'exp', productName: 'DHL-Express', chargeableWeightKg: 1, volumetricWeightKg: 1, isVolumetric: false, currency: 'CNY', carrierCost: 200, sellPrice: 230, margin: 30, reachable: true },
  ]
}

/** 构造 mock PrismaService（仅 quote 命名空间），返回各方法 mock 便于断言 */
function buildMockPrisma() {
  const quote = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  }
  return { prisma: { quote } as unknown as PrismaService, quote }
}

describe('QuotesService (11.2 持久化到 quotes)', () => {
  it('创建试算单：生成 quote_id 并落库，状态 ACTIVE，results 完整重建', async () => {
    const { prisma, quote } = buildMockPrisma()
    quote.create.mockResolvedValueOnce({
      id: 'q-1', tenantId: 't1', productId: 'std',
      inputSnapshot: req(), rateSnapshot: { results: results() },
      currency: 'CNY', status: 'active', selectedProductCode: null,
      expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
      carrierCost: { toNumber: () => 100 }, sellPrice: { toNumber: () => 115 }, margin: { toNumber: () => 15 },
    })
    const svc = new QuotesService(stubLogger() as unknown as never, prisma)
    const q = await svc.create('t1', req(), results(), 'CNY')
    expect(quote.create).toHaveBeenCalledTimes(1)
    const data = quote.create.mock.calls[0][0].data
    expect(data.tenantId).toBe('t1')
    expect(data.status).toBe(QuoteStatus.ACTIVE)
    expect(data.rateSnapshot).toEqual({ results: results() }) // 完整结果落库
    expect(q.results).toHaveLength(2) // 回查重建
    expect(q.status).toBe(QuoteStatus.ACTIVE)
  })

  it('租户隔离：跨租户取单抛 QUOTE_NOT_FOUND（查询带 id 不泄露他租户）', async () => {
    const { prisma, quote } = buildMockPrisma()
    quote.findUnique.mockResolvedValueOnce({ id: 'q-1', tenantId: 't1', status: 'active' })
    const svc = new QuotesService(stubLogger() as unknown as never, prisma)
    await expect(svc.get('other', 'q-1')).rejects.toThrow(/试算单不存在/)
  })

  it('渠道自选：标记列表内产品并刷新锁定价；选列表外产品抛 QUOTE_ITEM_NOT_FOUND', async () => {
    const { prisma, quote } = buildMockPrisma()
    const base = {
      id: 'q-1', tenantId: 't1', productId: 'std',
      inputSnapshot: req(), rateSnapshot: { results: results() },
      currency: 'CNY', status: 'active', selectedProductCode: null,
      expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(),
      carrierCost: { toNumber: () => 100 }, sellPrice: { toNumber: () => 115 }, margin: { toNumber: () => 15 },
    }
    quote.findUnique.mockResolvedValueOnce(base)
    quote.update.mockResolvedValueOnce({ ...base, selectedProductCode: 'exp', productId: 'exp', carrierCost: { toNumber: () => 200 }, sellPrice: { toNumber: () => 230 }, margin: { toNumber: () => 30 } })
    const svc = new QuotesService(stubLogger() as unknown as never, prisma)
    const updated = await svc.select('t1', 'q-1', 'exp')
    expect(updated.selectedProductCode).toBe('exp')
    // 锁定价随自选刷新落库（DB 行 + update 调用验证）
    const upd = quote.update.mock.calls[0][0]
    expect(upd.data.selectedProductCode).toBe('exp')
    expect(upd.data.carrierCost).toBeDefined()
    expect(quote.update).toHaveBeenCalled()
    // 选列表外产品
    quote.findUnique.mockResolvedValueOnce(base)
    await expect(svc.select('t1', 'q-1', 'nope')).rejects.toThrow(/不含该产品/)
  })

  it('过期校验：expiresAt 早于当前 → 回写 EXPIRED 并抛 QUOTE_EXPIRED', async () => {
    const { prisma, quote } = buildMockPrisma()
    quote.findUnique.mockResolvedValueOnce({
      id: 'q-1', tenantId: 't1', productId: 'std',
      inputSnapshot: req(), rateSnapshot: { results: results() },
      currency: 'CNY', status: 'active', selectedProductCode: null,
      expiresAt: new Date(Date.now() - 1000), createdAt: new Date(),
      carrierCost: { toNumber: () => 100 }, sellPrice: { toNumber: () => 115 }, margin: { toNumber: () => 15 },
    })
    const svc = new QuotesService(stubLogger() as unknown as never, prisma)
    await expect(svc.get('t1', 'q-1')).rejects.toThrow(/已过期/)
    expect(quote.update).toHaveBeenCalledWith({ where: { id: 'q-1' }, data: { status: QuoteStatus.EXPIRED } })
  })
})
