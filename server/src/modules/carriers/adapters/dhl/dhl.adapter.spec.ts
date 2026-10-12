/**
 * DhlAdapter 单测（任务 3.3，方案 §1.1 / §3）。
 * 不依赖真实网络：用 FakeDhlHttp 桩返回 DHL 形态报文，验证
 * ① OAuth2 Basic 头鉴权 + 令牌缓存 ② 比价/建单/面单/轨迹归一化
 * ③ 能力声明（无 cancel/subscribe，轮询型 §1.2.2）④ 缺凭证/不支持操作拦截。
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
import { DhlAdapter } from './dhl.adapter'
import { DHL_ENDPOINTS } from './dhl-auth.config'
import { DhlRateResponse, DhlShipmentResponse, DhlTrackingResponse } from './dhl.types'

/** 标准化成功响应包装 */
function ok<T>(data: T): Promise<RetryableResponse<T>> {
  return Promise.resolve({ status: 200, ok: true, data, rawText: '' })
}

/** 内存桩 HTTP：按 URL/方法返回 DHL 形态报文，记录令牌换取次数与请求头 */
class FakeDhlHttp {
  tokenCalls = 0
  capturedHeaders: Record<string, string> | undefined

  request<T>(url: string, options?: RetryableRequestOptions): Promise<RetryableResponse<T>> {
    this.capturedHeaders = options?.headers
    if (url.includes(DHL_ENDPOINTS.token)) {
      this.tokenCalls++
      return ok({ access_token: 'dhl_tk', token_type: 'Bearer', expires_in: 3600 } as unknown as T)
    }
    if (url.includes('/v1/rates')) return ok(rateResponse() as unknown as T)
    if (url.includes('/tracking')) return ok(trackingResponse() as unknown as T)
    if (url.includes('/v1/shipments')) return ok(shipmentResponse() as unknown as T) // 建单(POST)或面单(GET)
    return Promise.resolve({ status: 404, ok: false, data: null as unknown as T, rawText: 'nf' })
  }

  requestJson<T>(url: string, options?: RetryableRequestOptions): Promise<T> {
    return this.request<T>(url, options).then((r) => r.data)
  }
}

function rateResponse(): DhlRateResponse {
  return {
    products: [{ productName: 'DHL Express Worldwide', productCode: 'P', totalPrice: [{ type: 'TOTAL', price: 200, currency: 'USD' }] }],
  }
}

function shipmentResponse(): DhlShipmentResponse {
  return {
    shipmentTrackingNumber: 'DHL-TRK-1',
    shipmentId: 'DHL-WB-1',
    labels: [{ binaryData: 'JVBERi0x', type: 'PDF' }],
  }
}

function trackingResponse(): DhlTrackingResponse {
  return {
    shipments: [
      {
        trackingEvents: [
          { dateTime: '2026-10-12T01:00:00Z', status: 'booked', description: 'created' },
          { dateTime: '2026-10-12T08:00:00Z', status: 'pickup', description: 'picked up', location: { address: { cityName: 'SZ', countryName: 'CN' } } },
          { dateTime: '2026-10-13T02:00:00Z', status: 'transit', description: 'in transit' },
          { dateTime: '2026-10-14T09:00:00Z', status: 'delivered', description: 'delivered' },
        ],
      },
    ],
  }
}

function buildAdapter(authConfig?: unknown): { adapter: DhlAdapter; http: FakeDhlHttp } {
  const http = new FakeDhlHttp()
  const account: CarrierAccountContext = {
    id: 'a1',
    tenantId: 't1',
    carrierCode: 'dhl',
    authConfig: authConfig ?? { clientId: 'cid', clientSecret: 'csec', apiKey: 'akey', accountNumber: '123456' },
  }
  return { adapter: new DhlAdapter(account, http as unknown as RetryableHttpService, new AppLogger()), http }
}

describe('DhlAdapter', () => {
  it('getCode 返回 dhl', () => {
    expect(buildAdapter().adapter.getCode()).toBe(CarrierCode.DHL)
  })

  it('能力声明：轮询型，仅 RATE/SHIP/LABEL/TRACK（无 cancel/subscribe，§1.2.2）', async () => {
    const health = await buildAdapter().adapter.healthCheck()
    expect(health.capabilities).toEqual([
      CarrierCapability.RATE,
      CarrierCapability.SHIP,
      CarrierCapability.LABEL,
      CarrierCapability.TRACK,
    ])
  })

  it('比价：映射产品成本与计费重，请求头带 Bearer 与 DHL-API-Key（§1.1）', async () => {
    const { adapter, http } = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'US',
      origin: 'CN',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }], // 体积重=1.2kg
    }
    const quotes = await adapter.getRates(req)
    expect(quotes).toHaveLength(1)
    const q = quotes[0]
    expect(q.productCode).toBe('P')
    expect(q.chargeableWeightKg).toBe(2) // max(2, 1.2)
    expect(q.carrierCost).toBe(200)
    expect(q.currency).toBe('USD')
    expect(http.capturedHeaders?.Authorization).toBe('Bearer dhl_tk')
    expect(http.capturedHeaders?.['DHL-API-Key']).toBe('akey')
  })

  it('建单返回运单/轨迹号与面单 base64', async () => {
    const { adapter } = buildAdapter()
    const req: CreateShipmentRequest = {
      orderRef: 'O1',
      origin: 'CN',
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }],
      recipient: { name: 'Bob', country: 'US', city: 'LA', address1: '1 Main St' },
    }
    const res = await adapter.createShipment(req)
    expect(res.waybillNo).toBe('DHL-TRK-1')
    expect(res.trackingNo).toBe('DHL-TRK-1')
    expect(res.labelZpl).toBe('JVBERi0x')
    expect(res.carrierCost).toBe(0) // 成本占位，待费用回传（§9）
  })

  it('面单返回 PDF 内容与格式', async () => {
    const { adapter } = buildAdapter()
    const label = await adapter.getLabel('DHL-TRK-1')
    expect(label.format).toBe('pdf')
    expect(label.waybillNo).toBe('DHL-TRK-1')
    expect(label.content).toBe('JVBERi0x')
  })

  it('轨迹：归一化末态为 delivered，地点拼接 city,country', async () => {
    const { adapter } = buildAdapter()
    const res = await adapter.getTracking('DHL-TRK-1')
    expect(res.carrierCode).toBe(CarrierCode.DHL)
    expect(res.status).toBe(CarrierTrackingStatus.DELIVERED)
    expect(res.events).toHaveLength(4)
    expect(res.events[1].location).toBe('SZ, CN')
    expect(res.events[1].status).toBe(CarrierTrackingStatus.PICKED_UP)
  })

  it('取消/订阅不支持：抛清晰 NOT_IMPLEMENTED（诚实，§1.2.2/§13.2）', async () => {
    const { adapter } = buildAdapter()
    await expect(adapter.cancelShipment('DHL-TRK-1')).rejects.toMatchObject({ status: HttpStatus.NOT_IMPLEMENTED })
    await expect(adapter.subscribeTracking('DHL-TRK-1')).rejects.toMatchObject({ status: HttpStatus.NOT_IMPLEMENTED })
  })

  it('OAuth token 按实例缓存：两次接口调用仅换取 1 次', async () => {
    const { adapter, http } = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'US',
      origin: 'CN',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await adapter.getRates(req)
    await adapter.getTracking('DHL-TRK-1')
    expect(http.tokenCalls).toBe(1)
  })

  it('缺凭证拦截：OAuth 配置为空时抛 BAD_REQUEST', async () => {
    const { adapter } = buildAdapter({})
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(adapter.getRates(req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
  })

  it('缺 accountNumber 拦截：比价抛 BAD_REQUEST', async () => {
    const { adapter } = buildAdapter({ clientId: 'cid', clientSecret: 'csec', apiKey: 'akey' })
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(adapter.getRates(req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
  })
})
