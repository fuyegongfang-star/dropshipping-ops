/**
 * FourPxAdapter 单测（任务 3.4，方案 §1.1 / §3）。
 * 不依赖真实网络：用 FakeFourPxHttp 桩返回 4PX router 报文（带 errorCode 信封），验证
 * ① MD5 签名调用（method 字段正确）② 比价/建单/面单/轨迹归一化 ③ 能力声明（无 subscribe）
 * ④ 取消 ⑤ 缺凭证拦截 ⑥ 订阅不支持抛 NOT_IMPLEMENTED。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { HttpStatus } from '@nestjs/common'
import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableRequestOptions,
  RetryableResponse,
} from '../../../../common/http/retryable-http.service'
import { CarrierCode, CarrierCapability } from '../../carrier.constants'
import { CarrierAccountContext } from '../../carrier-registry.service'
import { GetRatesRequest } from '../../dto/rate.dto'
import { CreateShipmentRequest } from '../../dto/shipment.dto'
import { CarrierTrackingStatus } from '../../dto/tracking.dto'
import { FourPxAdapter } from './fourpx.adapter'

/** 标准化成功响应包装 */
function ok<T>(data: T): Promise<RetryableResponse<T>> {
  return Promise.resolve({ status: 200, ok: true, data, rawText: '' })
}

/** 内存桩 HTTP：按 router 报文的 method 字段返回 4PX 形态数据 */
class FakeFourPxHttp {
  capturedMethod: string | undefined

  request<T>(url: string, options?: RetryableRequestOptions): Promise<RetryableResponse<T>> {
    const params = new URLSearchParams((options?.body as string) ?? '')
    this.capturedMethod = params.get('method') ?? undefined
    const method = this.capturedMethod
    if (method === 'getLogisticsProductList') return ok(productEnvelope() as unknown as T)
    if (method === 'createOrder') return ok(createEnvelope() as unknown as T)
    if (method === 'getLabelList') return ok(labelEnvelope() as unknown as T)
    if (method === 'qureyTrack') return ok(trackEnvelope() as unknown as T)
    if (method === 'cancelOrder') return ok({ errorCode: '0', data: {} } as unknown as T)
    return Promise.resolve({ status: 404, ok: false, data: null as unknown as T, rawText: 'nf' })
  }

  requestJson<T>(url: string, options?: RetryableRequestOptions): Promise<T> {
    return this.request<T>(url, options).then((r) => r.data)
  }
}

function productEnvelope(): { errorCode: string; data: { productCode: string; productName: string; fee: number; currency: string; leadTime: number }[] } {
  return {
    errorCode: '0',
    data: [{ productCode: '4PX-US', productName: '4PX-美国空运专线', fee: 150, currency: 'USD', leadTime: 7 }],
  }
}

function createEnvelope(): { errorCode: string; data: { expressNo: string; trackingNo: string; labelUrl: string } } {
  return { errorCode: '0', data: { expressNo: '4PX-WB-1', trackingNo: '4PX-TRK-1', labelUrl: 'https://4px.label/1.pdf' } }
}

function labelEnvelope(): { errorCode: string; data: { labelUrl: string } } {
  return { errorCode: '0', data: { labelUrl: 'https://4px.label/1.pdf' } }
}

function trackEnvelope(): {
  errorCode: string
  data: { expressNo: string; status: string; trackingDetails: { status: string; location?: string; time?: string; description?: string }[] }
} {
  return {
    errorCode: '0',
    data: {
      expressNo: '4PX-TRK-1',
      status: 'transit',
      trackingDetails: [
        { status: 'created', time: '2026-10-12T01:00:00Z', description: 'created' },
        { status: 'picked', location: 'SZ', time: '2026-10-12T08:00:00Z', description: 'picked up' },
        { status: 'transit', location: 'HK', time: '2026-10-13T02:00:00Z', description: 'in transit' },
      ],
    },
  }
}

function buildAdapter(authConfig?: unknown): FourPxAdapter {
  const account: CarrierAccountContext = {
    id: 'a1',
    tenantId: 't1',
    carrierCode: 'fourpx',
    authConfig: authConfig ?? { appKey: 'ak', appSecret: 'as' },
  }
  return new FourPxAdapter(account, new FakeFourPxHttp() as unknown as RetryableHttpService, new AppLogger())
}

describe('FourPxAdapter', () => {
  it('getCode 返回 fourpx', () => {
    expect(buildAdapter().getCode()).toBe(CarrierCode.FOURPX)
  })

  it('能力声明：RATE/SHIP/LABEL/TRACK/CANCEL（无 subscribe，§1.2.2）', async () => {
    const health = await buildAdapter().healthCheck()
    expect(health.capabilities).toEqual([
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
      CarrierCapability.CANCEL,
    ])
  })

  it('比价：映射产品成本与计费重', async () => {
    const adapter = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }], // 体积重=1.2kg
    }
    const quotes = await adapter.getRates(req)
    expect(quotes).toHaveLength(1)
    const q = quotes[0]
    expect(q.productCode).toBe('4PX-US')
    expect(q.chargeableWeightKg).toBe(2) // max(2, 1.2)
    expect(q.carrierCost).toBe(150)
    expect(q.estimatedLeadDaysMax).toBe(7)
  })

  it('建单返回运单/轨迹号与面单链接', async () => {
    const adapter = buildAdapter()
    const req: CreateShipmentRequest = {
      orderRef: 'O1',
      origin: 'SZ',
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }],
      recipient: { name: 'Bob', country: 'US', city: 'LA', address1: '1 Main St' },
    }
    const res = await adapter.createShipment(req)
    expect(res.waybillNo).toBe('4PX-WB-1')
    expect(res.trackingNo).toBe('4PX-TRK-1')
    expect(res.labelUrl).toBe('https://4px.label/1.pdf')
    expect(res.carrierCost).toBeNull() // 成本待回传（§9 C1：严禁占位 0）
  })

  it('面单返回 PDF 链接', async () => {
    const label = await buildAdapter().getLabel('4PX-WB-1')
    expect(label.format).toBe('pdf')
    expect(label.url).toBe('https://4px.label/1.pdf')
  })

  it('轨迹：归一化末态 transit，节点按序映射', async () => {
    const res = await buildAdapter().getTracking('4PX-TRK-1')
    expect(res.carrierCode).toBe(CarrierCode.FOURPX)
    expect(res.status).toBe(CarrierTrackingStatus.IN_TRANSIT)
    expect(res.events).toHaveLength(3)
    expect(res.events[1].status).toBe(CarrierTrackingStatus.PICKED_UP)
  })

  it('取消不抛异常（4PX 支持拦截）', async () => {
    await expect(buildAdapter().cancelShipment('4PX-WB-1')).resolves.toBeUndefined()
  })

  it('订阅不支持：抛清晰 NOT_IMPLEMENTED（轮询，§1.2.2）', async () => {
    await expect(buildAdapter().subscribeTracking('4PX-TRK-1')).rejects.toMatchObject({
      status: HttpStatus.NOT_IMPLEMENTED,
    })
  })

  it('缺凭证拦截：appKey/appSecret 为空时抛 BAD_REQUEST', async () => {
    const adapter = buildAdapter({})
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(adapter.getRates(req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
  })
})
