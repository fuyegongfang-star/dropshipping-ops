/**
 * 试算单服务单测（任务 3.7，方案 §4.6 试算→订单联动）。
 * 验证：创建落库 + quote_id、租户隔离、过期校验、渠道自选（仅列表内产品）。
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import 'reflect-metadata'
import { QuotesService } from './quotes.service'
import { QuoteStatus } from './quote.types'
import { CompareRequest } from '../pricing.types'
import { RateQuote } from '../../carriers/dto/rate.dto'

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

describe('QuotesService (3.7 试算门户)', () => {
  it('创建试算单：生成 quote_id 并落库，状态 ACTIVE', () => {
    const svc = new QuotesService(stubLogger() as unknown as never)
    const q = svc.create('t1', req(), results(), 'CNY')
    expect(q.id).toMatch(/^[0-9a-f-]{36}$/) // UUID
    expect(q.status).toBe(QuoteStatus.ACTIVE)
    expect(q.results).toHaveLength(2)
    expect(svc.get('t1', q.id).id).toBe(q.id) // 可回查
  })

  it('租户隔离：跨租户取单抛 QUOTE_NOT_FOUND', () => {
    const svc = new QuotesService(stubLogger() as unknown as never)
    const q = svc.create('t1', req(), results(), 'CNY')
    expect(() => svc.get('other', q.id)).toThrow(/试算单不存在/)
  })

  it('渠道自选：标记列表内产品；选列表外产品抛 QUOTE_ITEM_NOT_FOUND', () => {
    const svc = new QuotesService(stubLogger() as unknown as never)
    const q = svc.create('t1', req(), results(), 'CNY')
    const updated = svc.select('t1', q.id, 'std')
    expect(updated.selectedProductCode).toBe('std')
    expect(() => svc.select('t1', q.id, 'nope')).toThrow(/不含该产品/)
  })

  it('过期校验：TTL 为负时取单标记 EXPIRED 并抛 QUOTE_EXPIRED', () => {
    const svc = new QuotesService(stubLogger() as unknown as never, -1) // 立即可过期
    const q = svc.create('t1', req(), results(), 'CNY')
    expect(() => svc.get('t1', q.id)).toThrow(/已过期/)
  })

  it('有效期字段在创建时 = 当前 + TTL（默认 24h 量级）', () => {
    const svc = new QuotesService(stubLogger() as unknown as never)
    const before = Date.now()
    const q = svc.create('t1', req(), results(), 'CNY')
    const exp = new Date(q.expiresAt).getTime()
    expect(exp).toBeGreaterThan(before + 23 * 60 * 60 * 1000) // 至少 23h 后
  })
})
