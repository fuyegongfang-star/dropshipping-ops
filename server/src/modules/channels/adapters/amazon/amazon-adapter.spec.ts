/**
 * Amazon SP-API 适配器单测（任务 1.10 评估，方案 §29）。
 * 覆盖：LWA 令牌获取与缓存、Amazon 适配器拉单归一化、ChannelAdapter 接口贴合、SigV4 占位门控。
 * 全程不依赖真实网络（内存桩 fetch + 桩 LWA 客户端）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { HttpStatus } from '@nestjs/common'
import { RetryableHttpService } from '../../../../common/http/retryable-http.service'
import { AppLogger } from '../../../../common/logger/app.logger'
import { ChannelPlatform, ChannelOrderStatus } from '../../channel.constants'
import { AmazonLwaClient } from './amazon-lwa.client'
import {
  AmazonAdapter,
  NoopAmazonSigner,
} from './amazon-adapter'

/** 保存/恢复全局 fetch，避免跨用例污染 */
let savedFetch: typeof globalThis.fetch

beforeEach(() => {
  savedFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = savedFetch
})

describe('AmazonLwaClient（§29 认证闸门）', () => {
  it('refresh_token grant：获取令牌并缓存（二次调用不重复请求）', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ access_token: 'TOK', token_type: 'bearer', expires_in: 3600 }),
    })
    globalThis.fetch = fetchMock as never

    const client = new AmazonLwaClient(new RetryableHttpService(), new AppLogger())
    const tok = await client.getAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' })
    expect(tok).toBe('TOK')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 缓存命中：不过期则不再请求
    const tok2 = await client.getAccessToken({ clientId: 'c', clientSecret: 's', refreshToken: 'r' })
    expect(tok2).toBe('TOK')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const body = (fetchMock.mock.calls[0][1] as { body: string }).body
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=r')
  })
})

describe('AmazonAdapter（§29 评估）', () => {
  /** 桩 LWA 客户端（避免真实令牌请求） */
  const fakeLwa = { getAccessToken: jest.fn().mockResolvedValue('tok') }

  function buildAdapter(): AmazonAdapter {
    return new AmazonAdapter(
      new RetryableHttpService(),
      new AppLogger(),
      { clientId: 'c', clientSecret: 's', refreshToken: 'r', region: 'us-east-1', marketplaceId: 'ATVP' },
      fakeLwa as never,
      new NoopAmazonSigner(),
    )
  }

  it('getPlatform 返回 amazon（落入 §3 ChannelAdapter 框架）', () => {
    expect(buildAdapter().getPlatform()).toBe(ChannelPlatform.AMAZON)
  })

  it('pullOrders：拉单列表 + 补拉明细，归一化为内部 DTO（含 LWA 头与 SigV4 占位透传）', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/orders/v0/orders?')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              Orders: [
                {
                  AmazonOrderId: 'A1',
                  OrderStatus: 'Unshipped',
                  OrderTotal: { Amount: '50.00', CurrencyCode: 'USD' },
                  ShippingAddress: {
                    Name: 'Bob',
                    CountryCode: 'US',
                    City: 'LA',
                    AddressLine1: '1 St',
                    PostalCode: '90001',
                  },
                },
              ],
            }),
        })
      }
      if (url.includes('/items')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              OrderItems: [
                { SellerSKU: 'SKU-A', ASIN: 'B0', Title: 'Book', QuantityOrdered: 1, ItemPrice: { Amount: '50.00' } },
              ],
            }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => '{}' })
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const result = await adapter.pullOrders({})
    expect(result.length).toBe(1)
    const order = result[0].order
    expect(order.platformOrderNo).toBe('A1')
    expect(order.status).toBe(ChannelOrderStatus.PAID) // Unshipped → PAID
    expect(order.items[0].skuCode).toBe('SKU-A')
    expect(order.totalAmount).toBe(50)
    expect((fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers['x-amz-access-token']).toBe('tok')
  })

  it('pushFulfillment：SigV4 占位门控，标记待阶段5 完整对接（NOT_IMPLEMENTED）', async () => {
    const adapter = buildAdapter()
    await expect(
      adapter.pushFulfillment({ platformOrderNo: 'A1', trackingNo: 'T1' }),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_IMPLEMENTED })
  })
})
