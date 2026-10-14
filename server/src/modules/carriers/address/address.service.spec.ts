/**
 * 地址校验与分区单测（任务 3.12，方案 §18）。
 * 覆盖：必填校验、邮编格式、电话格式、质量分、标准化、分区/远程/可达、多承运商可行性。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

import { AddressService } from './address.service'
import { ZoneMapService } from './zone-map.service'
import { CarrierCode } from '../carrier.constants'

function build(): AddressService {
  return new AddressService(new ZoneMapService())
}

describe('ZoneMapService（§18 邮编→分区）', () => {
  const zone = new ZoneMapService()

  it('美国 5 位邮编格式合规', () => {
    expect(zone.isPostalFormatValid('US', '95014')).toBe(true)
    expect(zone.isPostalFormatValid('US', '95014-1234')).toBe(true)
  })

  it('德国邮编非 5 位视为非法', () => {
    expect(zone.isPostalFormatValid('DE', '1234')).toBe(false)
    expect(zone.isPostalFormatValid('DE', '10115')).toBe(true)
  })

  it('相同邮编稳定落入同一分区', () => {
    const a = zone.resolve('mock', 'US', '95014')
    const b = zone.resolve('mock', 'US', '95014')
    expect(a.zoneCode).toBe(b.zoneCode)
    expect(a.zoneCode).toMatch(/^ZONE_[1-5]$/)
  })

  it('美国远程前缀标记为偏远', () => {
    expect(zone.resolve('mock', 'US', '99501').isRemote).toBe(true) // 阿拉斯加
    expect(zone.resolve('mock', 'US', '95014').isRemote).toBe(false)
  })

  it('4PX 美国 ZONE_5 不可达（需转其他承运商/聚合兜底）', () => {
    // 取一个落在 ZONE_5 的美国邮编：首字符 4 → ZONE_5
    const remote = zone.resolve(CarrierCode.FOURPX, 'US', '45014')
    expect(remote.reachable).toBe(false)
  })
})

describe('AddressService（§18 脏地址检测 + 标准化 + 质量分）', () => {
  it('完整合法地址：通过且无 error', () => {
    const r = build().validate({
      country: 'us',
      name: 'John Doe',
      phone: '+1 415 555 0100',
      city: 'Cupertino',
      addressLine1: '1 Apple Park Way',
      postalCode: '95014',
      carriers: ['mock'],
    })
    expect(r.valid).toBe(true)
    expect(r.normalized.country).toBe('US')
    expect(r.normalized.postalCode).toBe('95014')
    expect(r.qualityScore).toBe(100)
    expect(r.issues.every((i) => i.level !== 'error')).toBe(true)
  })

  it('缺失目的国与邮编：error 级阻断', () => {
    const r = build().validate({ country: '', postalCode: '', carriers: ['mock'] })
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.code === 'COUNTRY_MISSING')).toBe(true)
    expect(r.issues.some((i) => i.code === 'POSTAL_MISSING')).toBe(true)
  })

  it('美国邮编格式非法：POSTAL_FORMAT error', () => {
    const r = build().validate({
      country: 'US',
      postalCode: 'ABC',
      carriers: ['mock'],
    })
    expect(r.valid).toBe(false)
    expect(r.issues.some((i) => i.code === 'POSTAL_FORMAT')).toBe(true)
  })

  it('电话格式可疑：warning 但不阻断', () => {
    const r = build().validate({
      country: 'US',
      postalCode: '95014',
      phone: 'abc',
      carriers: ['mock'],
    })
    expect(r.valid).toBe(true)
    expect(r.issues.some((i) => i.code === 'PHONE_FORMAT' && i.level === 'warning')).toBe(true)
  })

  it('质量分随字段完整度变化', () => {
    const full = build().validate({ country: 'US', postalCode: '95014', city: 'A', addressLine1: 'B', name: 'C', phone: '+1 2', carriers: ['mock'] })
    const partial = build().validate({ country: 'US', postalCode: '95014', carriers: ['mock'] })
    expect(full.qualityScore).toBeGreaterThan(partial.qualityScore)
  })

  it('多承运商可行性：不可达承运商被标记并给建议', () => {
    const r = build().validate({
      country: 'US',
      postalCode: '45014',
      carriers: [CarrierCode.FOURPX, CarrierCode.DHL],
    })
    const fourpx = r.feasibility.find((f) => f.carrierCode === CarrierCode.FOURPX)
    const dhl = r.feasibility.find((f) => f.carrierCode === CarrierCode.DHL)
    expect(fourpx?.reachable).toBe(false)
    expect(dhl?.reachable).toBe(true)
    expect(fourpx?.note).toMatch(/不可达/)
  })

  it('未指定承运商时默认评估全集', () => {
    const r = build().validate({ country: 'DE', postalCode: '10115' })
    expect(r.feasibility.length).toBeGreaterThan(1)
  })
})
