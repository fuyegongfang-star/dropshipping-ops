/**
 * 币种归一单测（任务 3.6，方案 §10.3）。
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import 'reflect-metadata'
import { FxService, MARKUP_BASE_CURRENCY } from './fx.service'

type StubLogger = { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
function stubLogger(): StubLogger {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn(), verbose: jest.fn() }
}

describe('FxService (3.6 币种归一)', () => {
  let fx: FxService
  beforeEach(() => {
    fx = new FxService(stubLogger() as unknown as never)
  })

  it('基准币种常量为 CNY', () => {
    expect(MARKUP_BASE_CURRENCY).toBe('CNY')
  })

  it('同币种归一返回原金额、无汇率快照', () => {
    const r = fx.toBase(100, 'CNY', 'CNY')
    expect(r.amount).toBe(100)
    expect(r.snapshot).toBeUndefined()
  })

  it('USD → CNY 按种子汇率 7.2 转换并带快照', () => {
    const r = fx.toBase(100, 'USD', 'CNY')
    expect(r.amount).toBeCloseTo(720, 5)
    expect(r.snapshot).toEqual({ from: 'USD', to: 'CNY', rate: 7.2, effectiveAt: expect.any(String) })
  })

  it('CNY → USD 反向汇率 1/7.2', () => {
    const r = fx.toBase(720, 'CNY', 'USD')
    expect(r.amount).toBeCloseTo(100, 5)
  })

  it('缺失汇率诚实抛错（不静默 1:1）', () => {
    expect(() => fx.getRate('JPY', 'CNY')).toThrow(/汇率缺失/)
  })

  it('setRate 可覆盖汇率', () => {
    fx.setRate('USD', 'CNY', 7.5)
    expect(fx.toBase(100, 'USD', 'CNY').amount).toBeCloseTo(750, 5)
  })
})
