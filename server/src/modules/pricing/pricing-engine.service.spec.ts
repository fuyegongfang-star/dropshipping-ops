/**
 * 比价引擎单测（任务 3.5，方案 §5 四层 + §4.1 试算模式）。
 * 直接实例化 PricingEngineService，用桩替换 CarrierRegistryService / CarriersService /
 * ReachabilityService / AppLogger，聚焦验证 4 层编排与 L4 诚实护栏：
 *   - L2 可达性地图过滤不可达承运商（不发起无效实时调用）
 *   - L3 实时池失败被捕获入 l3Failed，不中断其他承运商
 *   - L4 去重（同 carrierCode:productCode）→ 成本升序 → 截断 PRICING_MAX_RESULTS
 *   - 试算模式返回多列表不锁价；正式模式锁定成本最低 selected
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import 'reflect-metadata' // 类装饰器（class-validator/transformer）依赖 Reflect.getMetadata
import { CarrierAdapter } from '../carriers/carrier-adapter.interface'
import { CarrierCode } from '../carriers/carrier.constants'
import { CargoType, RateQuote } from '../carriers/dto/rate.dto'
import { CarrierRegistryService } from '../carriers/carrier-registry.service'
import { CarriersService } from '../carriers/carriers.service'
import { ReachabilityService } from './reachability.service'
import { PricingEngineService, PRICING_MAX_RESULTS } from './pricing-engine.service'
import { CompareRequest } from './pricing.types'

/** 构造一条最小报价（必填字段齐全，其余走默认值） */
function makeQuote(
  carrierCode: string,
  productCode: string,
  carrierCost: number,
  over: Partial<RateQuote> = {},
): RateQuote {
  return {
    carrierCode,
    productCode,
    productName: `${carrierCode}-${productCode}`,
    chargeableWeightKg: 1,
    volumetricWeightKg: 1,
    isVolumetric: false,
    currency: 'USD',
    carrierCost,
    reachable: true,
    ...over,
  }
}

/** 标准比价入参 */
function request(over: Partial<CompareRequest> = {}): CompareRequest {
  return {
    destCountry: 'US',
    parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    ...over,
  }
}

/** 桩适配器：getRates 返回固定报价列表 */
function stubAdapter(quotes: RateQuote[]): CarrierAdapter {
  return { getRates: jest.fn(async () => quotes) } as unknown as CarrierAdapter
}

describe('PricingEngineService (3.5)', () => {
  // 通用桩（每个用例按需覆盖实现）
  let registry: { listCodes: jest.Mock }
  let carriers: { resolveAdapter: jest.Mock }
  let reachability: { isReachable: jest.Mock }
  let markup: { enrichQuotes: jest.Mock }
  let logger: { debug: jest.Mock; warn: jest.Mock; error: jest.Mock; log: jest.Mock; verbose: jest.Mock }
  let svc: PricingEngineService

  beforeEach(() => {
    registry = { listCodes: jest.fn() }
    carriers = { resolveAdapter: jest.fn() }
    reachability = { isReachable: jest.fn(() => ({ reachable: true })) }
    // 加价层桩：透传（保持本文件对 L2/L3/L4 护栏的既有断言有效；加价逻辑由 markup 单测覆盖）
    markup = { enrichQuotes: jest.fn((_t: string, quotes: RateQuote[]) => quotes) }
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      verbose: jest.fn(),
    }
    svc = new PricingEngineService(
      registry as unknown as CarrierRegistryService,
      carriers as unknown as CarriersService,
      reachability as unknown as ReachabilityService,
      markup as unknown as never,
      logger as unknown as never,
    )
  })

  it('L2 可达性地图：不可达承运商不发起实时询价，且不进入结果', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS, CarrierCode.DHL, CarrierCode.YANWEN])
    // 燕文对敏感货不可达；其余可达
    reachability.isReachable.mockImplementation((code: CarrierCode, _country: string, cargo?: CargoType) =>
      code === CarrierCode.YANWEN && cargo === CargoType.SENSITIVE
        ? { reachable: false, reason: '燕文不支持敏感货' }
        : { reachable: true },
    )
    carriers.resolveAdapter.mockImplementation(async (tenantId: string, code: CarrierCode): Promise<CarrierAdapter> =>
      stubAdapter([makeQuote(code, 'std', 10)]),
    )

    const res = await svc.compare('t1', request({ cargoType: CargoType.SENSITIVE }))

    // L2 仅保留云途、DHL
    expect(res.layers.l2Reachable.sort()).toEqual([CarrierCode.DHL, CarrierCode.YUNEXPRESS])
    // L3 未为燕文发起调用
    expect(carriers.resolveAdapter).not.toHaveBeenCalledWith('t1', CarrierCode.YANWEN)
    expect(carriers.resolveAdapter).toHaveBeenCalledWith('t1', CarrierCode.YUNEXPRESS)
    expect(carriers.resolveAdapter).toHaveBeenCalledWith('t1', CarrierCode.DHL)
    expect(res.layers.l3Failed).toEqual([])
    expect(res.quotes.length).toBe(2)
  })

  it('L3 实时池：单承运商失败被捕获入 l3Failed，不中断其他承运商', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS, CarrierCode.DHL])
    carriers.resolveAdapter
      .mockImplementationOnce(async (): Promise<CarrierAdapter> => {
        throw new Error('carrier down')
      })
      .mockImplementationOnce(async (): Promise<CarrierAdapter> =>
        stubAdapter([makeQuote(CarrierCode.DHL, 'p', 8)]),
      )

    const res = await svc.compare('t1', request())

    expect(res.layers.l3Failed).toEqual([CarrierCode.YUNEXPRESS])
    expect(res.layers.l3Queried).toEqual([CarrierCode.DHL])
    expect(res.quotes).toEqual([makeQuote(CarrierCode.DHL, 'p', 8)])
    expect(logger.warn).toHaveBeenCalled()
  })

  it('L4 护栏：同 carrierCode:productCode 去重', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS])
    carriers.resolveAdapter.mockResolvedValue(
      stubAdapter([
        makeQuote(CarrierCode.YUNEXPRESS, 'std', 10),
        makeQuote(CarrierCode.YUNEXPRESS, 'std', 10), // 重复产品
        makeQuote(CarrierCode.YUNEXPRESS, 'exp', 20),
      ]),
    )

    const res = await svc.compare('t1', request())

    expect(res.quotes.map((q) => q.productCode)).toEqual(['std', 'exp'])
    expect(res.layers.l4Returned).toBe(2)
  })

  it('L4 护栏：按 carrierCost 升序排列', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS])
    carriers.resolveAdapter.mockResolvedValue(
      stubAdapter([
        makeQuote(CarrierCode.YUNEXPRESS, 'c', 30),
        makeQuote(CarrierCode.YUNEXPRESS, 'a', 10),
        makeQuote(CarrierCode.YUNEXPRESS, 'b', 20),
      ]),
    )

    const res = await svc.compare('t1', request())

    expect(res.quotes.map((q) => q.carrierCost)).toEqual([10, 20, 30])
  })

  it('L4 护栏：超过 PRICING_MAX_RESULTS 截断', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS])
    const many = Array.from({ length: PRICING_MAX_RESULTS + 5 }, (_, i) =>
      makeQuote(CarrierCode.YUNEXPRESS, `p${i}`, i + 1),
    )
    carriers.resolveAdapter.mockResolvedValue(stubAdapter(many))

    const res = await svc.compare('t1', request())

    expect(res.quotes.length).toBe(PRICING_MAX_RESULTS)
    expect(res.layers.l4Returned).toBe(PRICING_MAX_RESULTS)
  })

  it('试算模式：返回多列表且不锁价 (selected=undefined)', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS])
    carriers.resolveAdapter.mockResolvedValue(
      stubAdapter([
        makeQuote(CarrierCode.YUNEXPRESS, 'a', 10),
        makeQuote(CarrierCode.YUNEXPRESS, 'b', 20),
      ]),
    )

    const res = await svc.compare('t1', request({ trial: true }))

    expect(res.trial).toBe(true)
    expect(res.selected).toBeUndefined()
    expect(res.quotes.length).toBe(2)
  })

  it('正式模式：锁定成本最低报价为 selected', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS])
    carriers.resolveAdapter.mockResolvedValue(
      stubAdapter([
        makeQuote(CarrierCode.YUNEXPRESS, 'a', 10),
        makeQuote(CarrierCode.YUNEXPRESS, 'b', 5),
        makeQuote(CarrierCode.YUNEXPRESS, 'c', 20),
      ]),
    )

    const res = await svc.compare('t1', request({ trial: false }))

    expect(res.trial).toBe(false)
    expect(res.selected).toBeDefined()
    expect(res.selected?.productCode).toBe('b')
    expect(res.selected?.carrierCost).toBe(5)
  })

  it('L1 预热费率卡当前返回空（接口预留，真实价走 L3）', async () => {
    registry.listCodes.mockReturnValue([CarrierCode.YUNEXPRESS])
    carriers.resolveAdapter.mockResolvedValue(stubAdapter([makeQuote(CarrierCode.YUNEXPRESS, 'a', 10)]))

    const res = await svc.compare('t1', request())

    expect(res.layers.l1RateCardHits).toBe(0)
  })
})
