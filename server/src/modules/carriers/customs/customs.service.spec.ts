/**
 * 报关/合规校验服务单测（任务 3.10，方案 §19）。
 * 覆盖：申报价值、HS 格式、欧盟 IOSS/EORI、英国 EORI、美国 Section321、敏感货。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { CustomsService } from './customs.service'

const svc = new CustomsService()

describe('CustomsService.validate (§19)', () => {
  it('缺申报价值应报 error', () => {
    const r = svc.validate({ destCountry: 'US' })
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.code === 'DECLARED_VALUE_MISSING')).toBe(true)
  })

  it('欧盟缺 IOSS/EORI 应报 error，提供后通过', () => {
    expect(svc.validate({ destCountry: 'DE', declaredValue: 120, hsCode: '123456' }).valid).toBe(false)
    const ok = svc.validate({ destCountry: 'DE', declaredValue: 120, hsCode: '123456', ioss: 'IM1234567890', eori: 'DE123456789' })
    expect(ok.valid).toBe(true)
    expect(ok.recommendedDuty).toBe('DDP')
  })

  it('英国缺 EORI 应报 error', () => {
    const r = svc.validate({ destCountry: 'GB', declaredValue: 50, hsCode: '123456' })
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.code === 'GB_EORI_MISSING')).toBe(true)
  })

  it('美国 ≤$800 符合 Section321（T86），>$800 需正式申报', () => {
    const low = svc.validate({ destCountry: 'US', declaredValue: 600, hsCode: '123456' })
    expect(low.eligibleSection321).toBe(true)
    expect(low.recommendedDuty).toBe('T86')
    const high = svc.validate({ destCountry: 'US', declaredValue: 1200, hsCode: '123456' })
    expect(high.eligibleSection321).toBe(false)
    expect(high.recommendedDuty).toBe('T01')
  })

  it('美国勾选 Section321 但超限应报 error', () => {
    const r = svc.validate({ destCountry: 'US', declaredValue: 1200, hsCode: '123456', section321: true })
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.code === 'SECTION321_OVER_LIMIT')).toBe(true)
  })

  it('HS 编码格式错误应报 error', () => {
    const r = svc.validate({ destCountry: 'US', declaredValue: 50, hsCode: 'ABC' })
    expect(r.issues.some((i) => i.code === 'HS_FORMAT')).toBe(true)
  })

  it('敏感货物应给 warning 但不阻断', () => {
    const r = svc.validate({ destCountry: 'US', declaredValue: 50, hsCode: '123456', cargoType: 'battery' })
    expect(r.valid).toBe(true)
    expect(r.issues.some((i) => i.level === 'warning' && i.code === 'SENSITIVE_CARGO')).toBe(true)
  })
})
