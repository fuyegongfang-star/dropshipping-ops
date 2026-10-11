/**
 * MockCarrierAdapter 单测（任务 3.1，方案 §3）。
 * 验证：比价计费重逻辑（实重/体积重取大、多箱 Σ）、建单/面单/轨迹桩、取消/订阅无异常。
 * 全程不依赖真实网络（RetryableHttpService 不触发请求）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { MockCarrierAdapter } from './mock-carrier.adapter'
import { RetryableHttpService } from '../../../common/http/retryable-http.service'
import { AppLogger } from '../../../common/logger/app.logger'
import { CarrierCode, CarrierCapability } from '../carrier.constants'
import { GetRatesRequest } from '../dto/rate.dto'
import { CreateShipmentRequest } from '../dto/shipment.dto'
import { CarrierTrackingStatus } from '../dto/tracking.dto'

function buildAdapter(): MockCarrierAdapter {
  return new MockCarrierAdapter(new RetryableHttpService(), new AppLogger())
}

describe('MockCarrierAdapter', () => {
  it('getCode 返回 MOCK', () => {
    expect(buildAdapter().getCode()).toBe(CarrierCode.MOCK)
  })

  it('健康探测返回全能力', async () => {
    const health = await buildAdapter().healthCheck()
    expect(health.healthy).toBe(true)
    expect(health.capabilities).toEqual(Object.values(CarrierCapability))
  })

  it('比价：实重 > 体积重时计费重取实重', async () => {
    const adapter = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }], // 体积重=6000/5000=1.2kg
    }
    const quotes = await adapter.getRates(req)
    expect(quotes).toHaveLength(1)
    const q = quotes[0]
    expect(q.chargeableWeightKg).toBe(2) // max(2, 1.2)
    expect(q.isVolumetric).toBe(false)
    expect(q.carrierCost).toBe(120) // 2 * 60
    expect(q.sellPrice).toBe(144) // 120 * 1.2
    expect(q.reachable).toBe(true)
  })

  it('比价：体积重 > 实重时判为抛货，计费重取体积重', async () => {
    const adapter = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 50, widthCm: 40, heightCm: 30 }], // 体积重=60000/5000=12kg
    }
    const q = (await adapter.getRates(req))[0]
    expect(q.chargeableWeightKg).toBe(12)
    expect(q.isVolumetric).toBe(true)
    expect(q.carrierCost).toBe(720) // 12 * 60
  })

  it('比价：多箱 Σ 计费重（§4.2）', async () => {
    const adapter = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'DE',
      parcels: [
        { weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }, // 计费重 2
        { weightKg: 3, lengthCm: 30, widthCm: 20, heightCm: 10 }, // 计费重 3
      ],
    }
    const q = (await adapter.getRates(req))[0]
    expect(q.chargeableWeightKg).toBe(5) // 2 + 3
  })

  it('建单返回运单/轨迹号与成本', async () => {
    const adapter = buildAdapter()
    const req: CreateShipmentRequest = {
      orderRef: 'O1',
      origin: 'SZ',
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }],
    }
    const res = await adapter.createShipment(req)
    expect(res.waybillNo).toBe('MOCK-WB-O1')
    expect(res.trackingNo).toBe('MOCK-TRK-O1')
    expect(res.carrierCost).toBe(120)
    expect(res.labelUrl).toContain('O1')
  })

  it('面单返回 PDF 占位', async () => {
    const label = await buildAdapter().getLabel('MOCK-WB-O1')
    expect(label.format).toBe('pdf')
    expect(label.waybillNo).toBe('MOCK-WB-O1')
  })

  it('轨迹返回已揽收节点', async () => {
    const res = await buildAdapter().getTracking('MOCK-TRK-O1')
    expect(res.carrierCode).toBe(CarrierCode.MOCK)
    expect(res.status).toBe(CarrierTrackingStatus.PICKED_UP)
    expect(res.events).toHaveLength(1)
  })

  it('取消/订阅不抛异常', async () => {
    const adapter = buildAdapter()
    await expect(adapter.cancelShipment('MOCK-WB-O1')).resolves.toBeUndefined()
    await expect(adapter.subscribeTracking('MOCK-TRK-O1')).resolves.toBeUndefined()
  })
})
