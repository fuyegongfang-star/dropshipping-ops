/**
 * 履约路由单测（任务 1.5，方案 §4/§5）。
 * 覆盖：cheapest/fastest 策略选优、无可行渠道返回空推荐 + 说明、备选列表截取、推荐理由口径。
 * PricingEngineService 以桩替换，专注验证路由层策略与解释逻辑。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

import { FulfillmentRouterService, RouteStrategy } from './fulfillment-router.service'
import { AppLogger } from '../../common/logger/app.logger'
import { PricingEngineService } from './pricing-engine.service'
import { RateQuote } from '../carriers/dto/rate.dto'
import { CompareResult } from './pricing.types'

const QUOTES: RateQuote[] = [
  {
    carrierCode: 'yun', productCode: 'std', productName: '云途-标准专线', chargeableWeightKg: 1,
    volumetricWeightKg: 1, isVolumetric: false, currency: 'CNY', carrierCost: 50, sellPrice: 60,
    estimatedLeadDaysMin: 5, estimatedLeadDaysMax: 8, reachable: true,
  },
  {
    carrierCode: 'dhl', productCode: 'exp', productName: 'DHL-Express', chargeableWeightKg: 1,
    volumetricWeightKg: 1, isVolumetric: false, currency: 'CNY', carrierCost: 90, sellPrice: 110,
    estimatedLeadDaysMin: 2, estimatedLeadDaysMax: 4, reachable: true,
  },
  {
    carrierCode: 'yan', productCode: 'eco', productName: '燕文-经济线', chargeableWeightKg: 1,
    volumetricWeightKg: 1, isVolumetric: false, currency: 'CNY', carrierCost: 40, sellPrice: 48,
    estimatedLeadDaysMin: 10, estimatedLeadDaysMax: 15, reachable: true,
  },
]

function stubEngine(quotes: RateQuote[]): PricingEngineService {
  return {
    compare: jest.fn().mockResolvedValue({
      trial: true,
      quotes,
      layers: { l1RateCardHits: 0, l2Reachable: ['yun', 'dhl', 'yan'], l3Queried: ['yun', 'dhl', 'yan'], l3Failed: [], l4Returned: quotes.length },
      generatedAt: new Date().toISOString(),
    } as CompareResult),
  } as unknown as PricingEngineService
}

describe('FulfillmentRouterService（1.5 自动选渠道）', () => {
  it('cheapest 策略：选中售价最低的渠道（燕文-经济线 48）', async () => {
    const svc = new FulfillmentRouterService(stubEngine(QUOTES), new AppLogger())
    const res = await svc.route('t1', { destCountry: 'US', parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }], strategy: RouteStrategy.CHEAPEST })
    expect(res.recommended?.productCode).toBe('eco')
    expect(res.recommended?.sellPrice).toBe(48)
    // 备选取次优 3 条（此处共 3 条，剔除推荐后剩 2 条）
    expect(res.alternatives.length).toBe(2)
    expect(res.rationale).toContain('价格优先')
  })

  it('fastest 策略：选中时效下限最小的渠道（DHL 2 工作日）', async () => {
    const svc = new FulfillmentRouterService(stubEngine(QUOTES), new AppLogger())
    const res = await svc.route('t1', { destCountry: 'US', parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }], strategy: RouteStrategy.FASTEST })
    expect(res.recommended?.productCode).toBe('exp')
    expect(res.rationale).toContain('时效优先')
  })

  it('无可行渠道：推荐为空且给出说明（诚实原则）', async () => {
    const svc = new FulfillmentRouterService(stubEngine([]), new AppLogger())
    const res = await svc.route('t1', { destCountry: 'KP', parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }], strategy: RouteStrategy.CHEAPEST })
    expect(res.recommended).toBeUndefined()
    expect(res.alternatives.length).toBe(0)
    expect(res.rationale).toContain('未找到可达渠道')
  })
})
