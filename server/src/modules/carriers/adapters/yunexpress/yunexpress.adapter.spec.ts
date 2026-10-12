/**
 * YunExpressAdapter 单测（任务 3.2，方案 §1.1 / §3）。
 * 不依赖真实网络：用 FakeYunExpressHttp 桩返回云途形态报文，验证
 * ① 签名确定性/正确性（HMAC-SHA256）② 比价计费重映射 ③ 建单/面单/轨迹归一化
 * ④ 取消/订阅 ⑤ OAuth token 按实例缓存（仅换取 1 次）⑥ 缺凭证拦截。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { HttpStatus } from '@nestjs/common'
import { createHmac } from 'node:crypto'
import { AppLogger } from '../../../../common/logger/app.logger'
import {
  RetryableHttpService,
  RetryableRequestOptions,
  RetryableResponse,
} from '../../../../common/http/retryable-http.service'
import { CarrierCode } from '../../carrier.constants'
import { CarrierAccountContext } from '../../carrier-registry.service'
import { GetRatesRequest } from '../../dto/rate.dto'
import { CreateShipmentRequest } from '../../dto/shipment.dto'
import { CarrierTrackingStatus } from '../../dto/tracking.dto'
import { YunExpressAdapter } from './yunexpress.adapter'
import { signYunExpressRequest } from './yunexpress-sign.service'
import { YUNEXPRESS_ENDPOINTS } from './yunexpress-auth.config'
import {
  YunExpressCreateData,
  YunExpressEnvelope,
  YunExpressLabelData,
  YunExpressPricingData,
  YunExpressTrackingData,
} from './yunexpress.types'

/** 标准化成功响应包装 */
function ok<T>(data: T): Promise<RetryableResponse<T>> {
  return Promise.resolve({ status: 200, ok: true, data, rawText: '' })
}

/** 内存桩 HTTP：按 URL 返回云途形态报文，记录令牌换取次数与最后一次请求头 */
class FakeYunExpressHttp {
  tokenCalls = 0
  capturedHeaders: Record<string, string> | undefined

  request<T>(url: string, options?: RetryableRequestOptions): Promise<RetryableResponse<T>> {
    this.capturedHeaders = options?.headers
    if (url.includes(YUNEXPRESS_ENDPOINTS.token)) {
      this.tokenCalls++
      return ok({ access_token: 'tk_abc', token_type: 'bearer', expires_in: 7200 } as unknown as T)
    }
    if (url.endsWith(YUNEXPRESS_ENDPOINTS.pricing)) return ok(pricingEnvelope() as unknown as T)
    if (url.endsWith(YUNEXPRESS_ENDPOINTS.create)) return ok(createEnvelope() as unknown as T)
    if (url.endsWith(YUNEXPRESS_ENDPOINTS.print)) return ok(labelEnvelope() as unknown as T)
    if (url.endsWith(YUNEXPRESS_ENDPOINTS.tracking)) return ok(trackingEnvelope() as unknown as T)
    if (url.endsWith(YUNEXPRESS_ENDPOINTS.cancel) || url.endsWith(YUNEXPRESS_ENDPOINTS.subscribe)) {
      return ok({ code: 0, data: {} } as unknown as T)
    }
    return Promise.resolve({ status: 404, ok: false, data: null as unknown as T, rawText: 'nf' })
  }

  requestJson<T>(url: string, options?: RetryableRequestOptions): Promise<T> {
    return this.request<T>(url, options).then((r) => r.data)
  }
}

function pricingEnvelope(): YunExpressEnvelope<YunExpressPricingData> {
  return {
    code: 0,
    data: {
      products: [
        {
          productCode: 'YT-STD',
          productName: '云途-标准专线',
          fee: 120,
          currency: 'USD',
          leadTimeMin: 5,
          leadTimeMax: 8,
          reachable: true,
          remoteArea: false,
          fuelFee: 5,
        },
        {
          productCode: 'YT-ECO',
          productName: '云途-经济线',
          fee: 90,
          currency: 'USD',
          leadTimeMin: 8,
          leadTimeMax: 12,
          reachable: true,
          remoteArea: true,
          fuelFee: 3,
        },
      ],
    },
  }
}

function createEnvelope(): YunExpressEnvelope<YunExpressCreateData> {
  return { code: 0, data: { wayBillNo: 'YT-WB-001', trackingNo: 'YT-TRK-001', labelUrl: 'https://yun.label/001.pdf' } }
}

function labelEnvelope(): YunExpressEnvelope<YunExpressLabelData> {
  return { code: 0, data: { labelUrl: 'https://yun.label/001.pdf', labelBase64: 'JVBERi0x' } }
}

function trackingEnvelope(): YunExpressEnvelope<YunExpressTrackingData> {
  return {
    code: 0,
    data: {
      trackingNo: 'YT-TRK-001',
      status: 'InTransit',
      details: [
        { status: 'Created', dateTime: '2026-10-12T01:00:00Z', description: 'created' },
        { status: 'PickUp', location: 'SZ', dateTime: '2026-10-12T08:00:00Z', description: 'picked up' },
        { status: 'InTransit', location: 'HK', dateTime: '2026-10-13T02:00:00Z', description: 'departed' },
      ],
    },
  }
}

function buildAdapter(authConfig: unknown = { appId: 'app1', apiKey: 'secret1' }): YunExpressAdapter {
  const account: CarrierAccountContext = {
    id: 'a1',
    tenantId: 't1',
    carrierCode: 'yunexpress',
    authConfig,
  }
  return new YunExpressAdapter(account, new FakeYunExpressHttp() as unknown as RetryableHttpService, new AppLogger())
}

describe('YunExpressAdapter', () => {
  it('getCode 返回 yunexpress', () => {
    expect(buildAdapter().getCode()).toBe(CarrierCode.YUNEXPRESS)
  })

  it('签名：相同输入确定性一致，且与 crypto HMAC 一致（§1.1）', () => {
    const a = signYunExpressRequest('k', 'id', 123, 'body')
    const b = signYunExpressRequest('k', 'id', 123, 'body')
    expect(a).toBe(b)
    const expected = createHmac('sha256', 'k').update('id.123.body').digest('hex')
    expect(a).toBe(expected)
    expect(a).toMatch(/^[0-9a-f]{64}$/) // HMAC-SHA256 hex 长度 64
  })

  it('比价：实重>体积重时计费重取实重，映射产品含附加费，请求头带签名与令牌', async () => {
    const http = new FakeYunExpressHttp()
    const account: CarrierAccountContext = {
      id: 'a1',
      tenantId: 't1',
      carrierCode: 'yunexpress',
      authConfig: { appId: 'app1', apiKey: 'secret1' },
    }
    const adapter = new YunExpressAdapter(account, http as unknown as RetryableHttpService, new AppLogger())
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 2, lengthCm: 30, widthCm: 20, heightCm: 10 }], // 体积重=6000/5000=1.2kg
    }
    const quotes = await adapter.getRates(req)
    expect(quotes).toHaveLength(2)
    const std = quotes[0]
    expect(std.productCode).toBe('YT-STD')
    expect(std.chargeableWeightKg).toBe(2) // max(2, 1.2)
    expect(std.isVolumetric).toBe(false)
    expect(std.carrierCost).toBe(120)
    expect(std.reachable).toBe(true)
    expect(std.surcharges?.[0]).toMatchObject({ type: 'fuel', amount: 5, currency: 'USD' })
    // 请求头已带签名与 Bearer 令牌（§1.1）
    expect(http.capturedHeaders?.signature).toMatch(/^[0-9a-f]{64}$/)
    expect(http.capturedHeaders?.['app-key']).toBe('app1')
    expect(http.capturedHeaders?.Authorization).toBe('Bearer tk_abc')
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
    expect(res.waybillNo).toBe('YT-WB-001')
    expect(res.trackingNo).toBe('YT-TRK-001')
    expect(res.labelUrl).toBe('https://yun.label/001.pdf')
    expect(res.carrierCost).toBe(0) // 成本占位，待费用回传（§9）
  })

  it('面单返回 PDF 内容与链接', async () => {
    const label = await buildAdapter().getLabel('YT-WB-001')
    expect(label.format).toBe('pdf')
    expect(label.waybillNo).toBe('YT-WB-001')
    expect(label.content).toBe('JVBERi0x')
    expect(label.url).toBe('https://yun.label/001.pdf')
  })

  it('轨迹：原生状态归一化为 in_transit，节点按序映射', async () => {
    const res = await buildAdapter().getTracking('YT-TRK-001')
    expect(res.carrierCode).toBe(CarrierCode.YUNEXPRESS)
    expect(res.status).toBe(CarrierTrackingStatus.IN_TRANSIT)
    expect(res.events).toHaveLength(3)
    expect(res.events[0].status).toBe(CarrierTrackingStatus.CREATED)
    expect(res.events[1].location).toBe('SZ')
  })

  it('取消/订阅不抛异常', async () => {
    const adapter = buildAdapter()
    await expect(adapter.cancelShipment('YT-WB-001')).resolves.toBeUndefined()
    await expect(adapter.subscribeTracking('YT-TRK-001')).resolves.toBeUndefined()
  })

  it('OAuth token 按实例缓存：两次接口调用仅换取 1 次', async () => {
    const http = new FakeYunExpressHttp()
    const account: CarrierAccountContext = { id: 'a1', tenantId: 't1', carrierCode: 'yunexpress', authConfig: { appId: 'app1', apiKey: 'secret1' } }
    const adapter = new YunExpressAdapter(account, http as unknown as RetryableHttpService, new AppLogger())
    await adapter.getRates({ destCountry: 'US', parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }] })
    await adapter.getTracking('YT-TRK-001')
    expect(http.tokenCalls).toBe(1)
  })

  it('缺凭证拦截：appId/apiKey 为空时抛 BAD_REQUEST', async () => {
    const adapter = buildAdapter({})
    const req: GetRatesRequest = {
      destCountry: 'US',
      parcels: [{ weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10 }],
    }
    await expect(adapter.getRates(req)).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST })
  })
})
