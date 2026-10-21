/**
 * Amazon 适配器 §29 完整对接能力单测：FBA Inbound / Shipping / Reports。
 * 全程不依赖真实网络（内存桩 fetch + 桩签名器），验证请求构建、响应归一化与对账解析。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-20
 */

import { gzipSync } from 'zlib'
import {
  AmazonAdapter,
  AmazonRequestSigner,
  AmazonSignRequest,
} from './amazon-adapter'
import { RetryableHttpService } from '../../../../common/http/retryable-http.service'
import { AppLogger } from '../../../../common/logger/app.logger'

/** 桩签名器：仅注入固定 Authorization 头，便于断言请求已签名 */
class FakeSigner implements AmazonRequestSigner {
  async sign(req: AmazonSignRequest): Promise<AmazonSignRequest> {
    return { ...req, headers: { ...req.headers, Authorization: 'AWS4-FAKE' } }
  }
}

/** 桩 LWA 客户端 */
const fakeLwa = { getAccessToken: jest.fn().mockResolvedValue('tok') }

function buildAdapter(): AmazonAdapter {
  return new AmazonAdapter(
    new RetryableHttpService(),
    new AppLogger(),
    { clientId: 'c', clientSecret: 's', refreshToken: 'r', region: 'us-east-1', marketplaceId: 'ATVP' },
    fakeLwa as never,
    new FakeSigner(),
  )
}

let savedFetch: typeof globalThis.fetch
beforeEach(() => {
  savedFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = savedFetch
})

describe('AmazonAdapter §29 FBA Inbound（头程入仓）', () => {
  it('createInboundShipmentPlan：POST plans 并返回归一化计划', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          payload: {
            InboundShipmentPlans: [
              {
                ShipmentPlanId: 'PLAN-1',
                DestinationFulfillmentCenterId: 'IND9',
                Items: [
                  { SellerSKU: 'SKU-A', Quantity: 10, FulfillmentNetworkSKU: 'X-1' },
                ],
              },
            ],
          },
        }),
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const plans = await adapter.createInboundShipmentPlan({
      items: [{ sellerSku: 'SKU-A', quantity: 10 }],
      shipFromAddress: { Name: 'Wh', City: 'Shenzhen' },
    })
    expect(plans.length).toBe(1)
    expect(plans[0].shipmentPlanId).toBe('PLAN-1')
    expect(plans[0].destinationFulfillmentCenterId).toBe('IND9')
    expect(plans[0].items[0].fulfillmentNetworkSku).toBe('X-1')
    expect(fetchMock.mock.calls[0][0]).toContain('/fba/inbound/v0/plans')
    expect((fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization).toBe('AWS4-FAKE')
  })

  it('createInboundShipment + getInboundShipment：建仓与查询', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/shipments')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              payload: {
                ShipmentId: 'FBA1',
                ShipmentName: 'plan',
                DestinationFulfillmentCenterId: 'IND9',
                ShipmentStatus: 'WORKING',
                Items: [{ SellerSKU: 'SKU-A', QuantityShipped: 10 }],
              },
            }),
        })
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => '{}' })
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const plan = await adapter.createInboundShipmentPlan({
      items: [{ sellerSku: 'SKU-A', quantity: 10 }],
      shipFromAddress: { City: 'SZ' },
    }).then(() => ({
      shipmentPlanId: 'PLAN-1',
      destinationFulfillmentCenterId: 'IND9',
      items: [{ sellerSku: 'SKU-A', quantity: 10, fulfillmentNetworkSku: 'X-1' }],
    }))
    const shipment = await adapter.createInboundShipment({
      shipmentName: 'plan',
      plan,
      shipFromAddress: { City: 'SZ' },
    })
    expect(shipment.status).toBe('WORKING')
    expect(shipment.items[0].quantity).toBe(10)

    const fetched = await adapter.getInboundShipment('FBA1')
    expect(fetched.shipmentId).toBe('FBA1')
    expect(fetchMock.mock.calls.some((c) => c[0].includes('/shipments/FBA1'))).toBe(true)
  })

  it('getPrepInstructions：SKU 预处理指引', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          payload: {
            SKUPrepInstructionsList: [
              { SellerSKU: 'SKU-A', PrepGuidance: 'NO_PREP_NEEDED', PrepOwner: 'AMAZON' },
            ],
          },
        }),
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const prep = await adapter.getPrepInstructions(['SKU-A'])
    expect(prep[0].prepGuidance).toBe('NO_PREP_NEEDED')
    expect(prep[0].prepOwner).toBe('AMAZON')
    expect(fetchMock.mock.calls[0][0]).toContain('/prepInstructions')
  })
})

describe('AmazonAdapter §29 Shipping（买运单）', () => {
  it('purchaseShippingLabel：POST mfn/shipments 返回追踪号与面单', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          payload: {
            ShipmentId: 'SHIP-1',
            TrackingId: 'TZ-1',
            Label: { FileType: 'PDF', FileContents: 'BASE64==', DownloadUrl: 'https://x/l' },
          },
        }),
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const label = await adapter.purchaseShippingLabel({ amazonOrderId: 'A1', items: [{ sellerSku: 'SKU-A', quantity: 1 }] })
    expect(label.trackingId).toBe('TZ-1')
    expect(label.labelFileType).toBe('PDF')
    expect(label.labelFileContents).toBe('BASE64==')
    expect(fetchMock.mock.calls[0][0]).toContain('/mfn/v0/shipments')
  })
})

describe('AmazonAdapter §29 Reports（对账）', () => {
  it('requestReport + getReport：创建与轮询报表', async () => {
    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/reports')) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ payload: { reportId: 'R1', reportType: 'SETTLE', processingStatus: 'IN_QUEUE' } }) })
      }
      if (url.includes('/reports/R1')) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ payload: { reportId: 'R1', reportType: 'SETTLE', processingStatus: 'DONE' } }) })
      }
      return Promise.resolve({ ok: true, status: 200, text: async () => '{}' })
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const created = await adapter.requestReport('SETTLE')
    expect(created.reportId).toBe('R1')
    const got = await adapter.getReport('R1')
    expect(got.processingStatus).toBe('DONE')
  })

  it('getReportDocument + settlement 解析：GZIP 解码并归集金额', async () => {
    const tsv =
      'transaction-type\tamount-type\tamount\tcurrency-code\n' +
      'Order\tItemPrice\t100.00\tUSD\n' +
      'Order\tItemFees\t-15.00\tUSD\n' +
      'Order\tFBAFees\t-5.00\tUSD\n'
    const gz = gzipSync(Buffer.from(tsv, 'utf8'))

    const fetchMock = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/documents/D1')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ documentId: 'D1', url: 'https://pre-signed.amazon.com/doc.gz', compressionAlgorithm: 'GZIP' }),
        })
      }
      // 预签名文档下载：返回 gzip 字节
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: async () => gz })
    })
    globalThis.fetch = fetchMock as never

    const adapter = buildAdapter()
    const text = await adapter.getReportDocument('D1')
    expect(text).toContain('ItemPrice')
    const summary = await adapter.getSettlementSummary('D1')
    expect(summary.currency).toBe('USD')
    expect(summary.totalAmount).toBe(100)
    expect(summary.totalFee).toBe(20)
    expect(summary.net).toBe(80)
    expect(summary.transactionCount).toBe(3)
    const itemFees = summary.byType.find((b) => b.type === 'ItemFees')
    expect(itemFees?.amount).toBe(-15)
  })
})
