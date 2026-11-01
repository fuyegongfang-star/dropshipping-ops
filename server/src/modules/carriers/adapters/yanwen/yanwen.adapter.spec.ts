/**
 * YanwenAdapter 单测（任务 3.4，方案 §1.1 / §3）。
 * 不依赖真实网络：用 FakeYanwenHttp 桩返回燕文形态报文（按 method 字段路由），验证
 * ① MD5 签名调用 ② 建单/面单/轨迹归一化 ③ 能力声明（仅 SHIP/LABEL/TRACK）
 * ④ 不支持操作（比价/取消/订阅）诚实抛 NOT_IMPLEMENTED ⑤ 缺凭证拦截。
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
import { YanwenAdapter } from './yanwen.adapter'

/** 标准化成功响应包装 */
function ok<T>(data: T): Promise<RetryableResponse<T>> {
  return Promise.resolve({ status: 200, ok: true, data, rawText: '' })
}

/** 内存桩 HTTP：按 query 的 method 字段返回燕文形态数据 */
class FakeYanwenHttp {
  capturedMethod: string | undefined

  request<T>(url: string, _options?: RetryableRequestOptions): Promise<RetryableResponse<T>> {
    const q = url.includes('?') ? url.split('?')[1] : ''
    const params = new URLSearchParams(q)
    this.capturedMethod = params.get('method') ?? undefined
    const method = this.capturedMethod
    if (method === 'order.create') return ok(createEnvelope() as unknown as T)
    if (method === 'order.detail') return ok(labelEnvelope() as unknown as T)
    if (method === 'track.query') return ok(trackEnvelope() as unknown as T)
    return Promise.resolve({ status: 404, ok: false, data: null as unknown as T, rawText: 'nf' })
  }

  requestJson<T>(url: string, options?: RetryableRequestOptions): Promise<T> {
    return this.request<T>(url, options).then((r) => r.data)
  }
}

function createEnvelope(): { waybillNumber: string; trackingNo: string; labelUrl: string } {
  return { waybillNumber: 'YW-WB-1', trackingNo: 'YW-TRK-1', labelUrl: 'https://yw.label/1.pdf' }
}

function labelEnvelope(): { labelUrl: string } {
  return { labelUrl: 'https://yw.label/1.pdf' }
}

function trackEnvelope(): {
  waybillNumber: string
  status: string
  trackDetails: { status: string; location?: string; time?: string; description?: string }[]
} {
  return {
    waybillNumber: 'YW-TRK-1',
    status: 'transit',
    trackDetails: [
      { status: 'created', time: '2026-10-12T01:00:00Z', description: 'created' },
      { status: 'picked', location: 'SZ', time: '2026-10-12T08:00:00Z', description: 'picked up' },
      { status: 'transit', location: 'HK', time: '2026-10-13T02:00:00Z', description: 'in transit' },
    ],
  }
}

function buildAdapter(authConfig?: unknown): YanwenAdapter {
  const account: CarrierAccountContext = {
    id: 'a1',
    tenantId: 't1',
    carrierCode: 'yanwen',
    authConfig: authConfig ?? { userId: 'uid', apiToken: 'tok' },
  }
  return new YanwenAdapter(account, new FakeYanwenHttp() as unknown as RetryableHttpService, new AppLogger())
}

describe('YanwenAdapter', () => {
  it('getCode 返回 yanwen', () => {
    expect(buildAdapter().getCode()).toBe(CarrierCode.YANWEN)
  })

  it('能力声明：仅 SHIP/LABEL/TRACK（无比价/取消/订阅，§1.1/§1.2.2）', async () => {
    const health = await buildAdapter().healthCheck()
    expect(health.capabilities).toEqual([CarrierCapability.SHIP, CarrierCapability.LABEL, CarrierCapability.TRACK])
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
    expect(res.waybillNo).toBe('YW-WB-1')
    expect(res.trackingNo).toBe('YW-TRK-1')
    expect(res.labelUrl).toBe('https://yw.label/1.pdf')
    expect(res.carrierCost).toBeNull() // 成本待回传（§9 C1：严禁占位 0）
  })

  it('面单返回 PDF 链接', async () => {
    const label = await buildAdapter().getLabel('YW-WB-1')
    expect(label.format).toBe('pdf')
    expect(label.url).toBe('https://yw.label/1.pdf')
  })

  it('轨迹：归一化末态 transit，节点按序映射', async () => {
    const res = await buildAdapter().getTracking('YW-TRK-1')
    expect(res.carrierCode).toBe(CarrierCode.YANWEN)
    expect(res.status).toBe(CarrierTrackingStatus.IN_TRANSIT)
    expect(res.events).toHaveLength(3)
    expect(res.events[1].status).toBe(CarrierTrackingStatus.PICKED_UP)
  })

  it('比价/取消/订阅不支持：抛清晰 NOT_IMPLEMENTED（轮询/无自助 API，§1.1/§1.2.2）', async () => {
    const adapter = buildAdapter()
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(adapter.getRates(req)).rejects.toMatchObject({ status: HttpStatus.NOT_IMPLEMENTED })
    await expect(adapter.cancelShipment('YW-WB-1')).rejects.toMatchObject({ status: HttpStatus.NOT_IMPLEMENTED })
    await expect(adapter.subscribeTracking('YW-TRK-1')).rejects.toMatchObject({ status: HttpStatus.NOT_IMPLEMENTED })
  })

  it('缺凭证拦截：userId/apiToken 为空时抛 BAD_REQUEST', async () => {
    const adapter = buildAdapter({})
    const req: CreateShipmentRequest = {
      origin: 'SZ',
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(adapter.createShipment(req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
  })
})
