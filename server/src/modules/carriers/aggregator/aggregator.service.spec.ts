/**
 * 聚合平台兜底追踪单测（任务 3.13，方案 §3e）。
 * 覆盖：目录枚举、AfterShip/17TRACK 正常归一化、不支持平台诚实抛 NOT_IMPLEMENTED、fail 哨兵 fallback。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

import { AggregatorService } from './aggregator.service'
import { BusinessException } from '../../../common/response/business.exception'

describe('AggregatorService（§3e 聚合平台兜底追踪）', () => {
  const svc = new AggregatorService()

  it('目录包含 AfterShip 与 17TRACK，仅轨迹能力', () => {
    const cat = svc.listCatalog()
    expect(cat.map((c) => c.code).sort()).toEqual(['17track', 'aftership'])
    expect(cat.every((c) => c.capability === 'track')).toBe(true)
  })

  it('AfterShip 正常归一化尾程轨迹', () => {
    const r = svc.query({ aggregatorCode: 'aftership', carrierCode: 'dhl', trackingNo: 'ABC123' })
    expect(r.aggregatorName).toBe('AfterShip')
    expect(r.fallback).toBe(false)
    expect(r.events.length).toBeGreaterThan(0)
    expect(r.status).toBe('out_for_delivery')
  })

  it('17TRACK 同口径返回', () => {
    const r = svc.query({ aggregatorCode: '17track', carrierCode: 'yanwen', trackingNo: 'XYZ' })
    expect(r.aggregatorName).toBe('17TRACK')
    expect(r.aggregatorCode).toBe('17track')
  })

  it('不支持的聚合平台诚实抛 NOT_IMPLEMENTED', () => {
    expect(() => svc.query({ aggregatorCode: 'unknown', carrierCode: 'dhl', trackingNo: 'X' })).toThrow(BusinessException)
  })

  it('fail 哨兵：聚合未解析，返回 fallback 建议直连', () => {
    const r = svc.query({ aggregatorCode: 'aftership', carrierCode: 'dhl', trackingNo: 'track-fail-1' })
    expect(r.fallback).toBe(true)
    expect(r.status).toBe('unknown')
    expect(r.note).toMatch(/直连/)
  })
})
