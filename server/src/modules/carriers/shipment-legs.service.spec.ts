/**
 * 两段式运单编排服务单测（任务 3.8，方案 §14）。
 * 用桩 CarriersService 验证「全程拆两段 / 单段退化」的分流与聚合逻辑，无需真实承运商凭证。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { ShipmentLegsService } from './shipment-legs.service'
import { CarrierCode } from './carrier.constants'
import { CreateShipmentRequest, CreateShipmentResult } from './dto/shipment.dto'
import { LegType } from './dto/rate.dto'

/** 桩 CarriersService：按承运商代码返回确定性建单结果，便于断言 legs 映射 */
const fakeCarriers = {
  ship: jest.fn(
    (_tenantId: string, code: CarrierCode, req: CreateShipmentRequest): Promise<CreateShipmentResult> => {
      const isFirst = req.legType === LegType.FIRST
      return Promise.resolve({
        waybillNo: `${code}-WB-${isFirst ? 'F' : 'L'}`,
        trackingNo: `${code}-TRK-${isFirst ? 'F' : 'L'}`,
        carrierCost: isFirst ? 12.5 : 7.3,
        currency: 'USD',
        estimatedLeadDays: isFirst ? 4 : 3,
      })
    },
  ),
}

const service = new ShipmentLegsService(fakeCarriers as never)

const baseReq: CreateShipmentRequest = {
  origin: 'CN-SZ',
  destCountry: 'US',
  destZip: '90001',
  parcels: [{ weightKg: 1, lengthCm: 20, widthCm: 15, heightCm: 10 }],
  recipient: {
    name: 'John',
    country: 'US',
    city: 'Los Angeles',
    address1: '1 Main St',
  },
}

describe('ShipmentLegsService.compose (§14)', () => {
  beforeEach(() => fakeCarriers.ship.mockClear())

  it('全程单应拆为头程+尾程两段并聚合成本', async () => {
    const res = await service.compose('t1', {
      firstCarrierCode: CarrierCode.YUNEXPRESS,
      lastCarrierCode: CarrierCode.YANWEN,
      transitHub: 'OVERSEAS-US-WEST',
      shipment: baseReq,
    })

    // 两段建单被分别调用
    expect(fakeCarriers.ship).toHaveBeenCalledTimes(2)
    expect(res.legs).toHaveLength(2)

    const [first, last] = res.legs
    expect(first.legType).toBe(LegType.FIRST)
    expect(first.carrierCode).toBe(CarrierCode.YUNEXPRESS)
    expect(first.transitHub).toBe('OVERSEAS-US-WEST')
    expect(last.legType).toBe(LegType.LAST)
    expect(last.carrierCode).toBe(CarrierCode.YANWEN)

    // 成本聚合：12.5 + 7.3 = 19.8
    expect(res.totalCarrierCost).toBe(19.8)
    expect(res.currency).toBe('USD')
  })

  it('仅头程（缺尾程承运商）应退化为单段 FIRST', async () => {
    const res = await service.compose('t1', {
      firstCarrierCode: CarrierCode.MOCK,
      shipment: baseReq,
    })
    expect(fakeCarriers.ship).toHaveBeenCalledTimes(1)
    expect(res.legs).toHaveLength(1)
    expect(res.legs[0].legType).toBe(LegType.FIRST)
    expect(res.totalCarrierCost).toBe(12.5)
  })

  it('头程建单应以转运节点为目的国、不含收件人', async () => {
    await service.compose('t1', {
      firstCarrierCode: CarrierCode.DHL,
      lastCarrierCode: CarrierCode.FOURPX,
      transitHub: 'OVERSEAS-DE',
      shipment: baseReq,
    })
    const firstCall = fakeCarriers.ship.mock.calls[0][2] as CreateShipmentRequest
    expect(firstCall.destCountry).toBe('OVERSEAS-DE')
    expect(firstCall.recipient).toBeUndefined()
    const lastCall = fakeCarriers.ship.mock.calls[1][2] as CreateShipmentRequest
    expect(lastCall.origin).toBe('OVERSEAS-DE')
    expect(lastCall.recipient).toBeDefined()
  })
})
