/**
 * ChannelAdapter 框架单测（任务 1.1/1.2，方案 §3）。
 * 覆盖：注册表分发、拉单落库（pending_review 初始态）、可重试 HTTP 的指数退避策略、
 *      Shopify 适配器拉单归一化与回传。
 * 全程不依赖真实网络/数据库（Mock 适配器 + 内存桩 Prisma + 桩 fetch）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { ChannelRegistryService } from './channel-registry.service'
import { ChannelSyncService } from './channel-sync.service'
import { MockChannelAdapter } from './adapters/mock-channel.adapter'
import { ShopifyAdapter } from './adapters/shopify/shopify-adapter'
import { RetryableHttpService } from '../../common/http/retryable-http.service'
import { AppLogger } from '../../common/logger/app.logger'
import { ChannelPlatform, ChannelOrderStatus } from './channel.constants'
import { PrismaClient } from '@prisma/client'

describe('ChannelRegistryService', () => {
  it('注册实例/工厂/分发/未注册抛异常', () => {
    const registry = new ChannelRegistryService()
    const mock = new MockChannelAdapter(new RetryableHttpService(), new AppLogger())
    registry.registerAdapter(mock)

    expect(registry.has(ChannelPlatform.MOCK)).toBe(true)
    expect(registry.resolveForShop({ id: 's', tenantId: 't', platform: 'mock' })).toBe(mock)
    expect(registry.listPlatforms()).toContain(ChannelPlatform.MOCK)
    // 未注册平台应抛业务异常（优雅失败，不崩服务）
    expect(() =>
      registry.resolveForShop({ id: 's', tenantId: 't', platform: 'shopify' }),
    ).toThrow()
  })
})

describe('ChannelSyncService.pullAndStore', () => {
  it('拉单落库：新建订单进入 pending_review 初始态（§13.1）', async () => {
    const mock = new MockChannelAdapter(new RetryableHttpService(), new AppLogger())
    const registry = new ChannelRegistryService()
    registry.registerAdapter(mock)

    // 内存桩 Prisma：shop 命中，order 首次不存在 → 走 create 路径
    const prisma = {
      shop: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's1', tenantId: 't1', platform: 'mock', name: 'Mock' }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    }
    const sync = new ChannelSyncService(
      prisma as unknown as PrismaClient,
      registry,
      new AppLogger(),
    )

    const summary = await sync.pullAndStore('s1', {})
    expect(summary.created).toBe(2)
    expect(summary.failed).toBe(0)
    expect(prisma.order.create).toHaveBeenCalledTimes(2)

    const firstData = (prisma.order.create as jest.Mock).mock.calls[0][0].data
    expect(firstData.status).toBe('pending_review') // 状态机初始态
    expect(prisma.orderItem.createMany).toHaveBeenCalledTimes(2)
  })

  it('单条失败不中断整体（看门狗：单点失败跳过，§0/§31）', async () => {
    const mock = new MockChannelAdapter(new RetryableHttpService(), new AppLogger())
    const registry = new ChannelRegistryService()
    registry.registerAdapter(mock)

    const prisma = {
      shop: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's1', tenantId: 't1', platform: 'mock', name: 'Mock' }),
      },
      // 第一单 create 抛错，应被捕获并计入 failed，第二单正常
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockRejectedValueOnce(new Error('db down'))
          .mockResolvedValue({ id: 'o2' }),
        update: jest.fn().mockResolvedValue({}),
      },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }
    const sync = new ChannelSyncService(
      prisma as unknown as PrismaClient,
      registry,
      new AppLogger(),
    )

    const summary = await sync.pullAndStore('s1', {})
    expect(summary.created).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.errors.length).toBe(1)
  })
})

describe('RetryableHttpService 重试策略（看门狗 §0/§31）', () => {
  afterEach(() => jest.restoreAllMocks())

  it('5xx 指数退避重试后成功', async () => {
    const http = new RetryableHttpService()
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => 'err' })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ ok: 1 }) })
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock

    const res = await http.request('http://x', { baseDelayMs: 10 })
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2) // 首次 + 1 次重试
  })

  it('4xx（非 429）不重试直接抛', async () => {
    const http = new RetryableHttpService()
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' })
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock

    await expect(http.request('http://x')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('网络错误按 maxRetries 重试后抛出', async () => {
    const http = new RetryableHttpService()
    const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'))
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock

    await expect(http.request('http://x', { maxRetries: 2, baseDelayMs: 10 })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(3) // 首次 + 2 次重试
  })
})

describe('ShopifyAdapter（任务 1.2）', () => {
  afterEach(() => jest.restoreAllMocks())

  it('拉单：解析 Shopify 订单并归一化（含鉴权头）', async () => {
    const adapter = new ShopifyAdapter(new RetryableHttpService(), new AppLogger(), {
      shopDomain: 'x.myshopify.com',
      accessToken: 'tok',
    })
    const payload = {
      orders: [
        {
          id: 999,
          order_number: 1001,
          financial_status: 'paid',
          fulfillment_status: null,
          created_at: '2026-10-10T10:00:00Z',
          currency: 'USD',
          total_price: '99.00',
          shipping_address: {
            first_name: 'A',
            last_name: 'B',
            phone: '123',
            address1: '1 St',
            city: 'LA',
            province: 'CA',
            zip: '90001',
            country_code: 'US',
          },
          line_items: [{ sku: 'S1', title: 'Tee', quantity: 2, price: '49.50' }],
        },
      ],
    }
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(payload) })
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock

    const result = await adapter.pullOrders({})
    expect(result.length).toBe(1)
    const order = result[0].order
    expect(order.platformOrderNo).toBe('999')
    expect(order.status).toBe(ChannelOrderStatus.PAID)
    expect(order.items[0].skuCode).toBe('S1')
    expect(order.items[0].quantity).toBe(2)
    expect(order.totalAmount).toBe(99)
    expect(result[0].raw).toEqual(payload.orders[0])

    const callUrl = fetchMock.mock.calls[0][0] as string
    const init = fetchMock.mock.calls[0][1]
    expect(callUrl).toContain('admin/api/2024-01/orders.json')
    expect(init.headers['X-Shopify-Access-Token']).toBe('tok')
  })

  it('回传：构建履约请求并返回成功', async () => {
    const adapter = new ShopifyAdapter(new RetryableHttpService(), new AppLogger(), {
      shopDomain: 'x.myshopify.com',
      accessToken: 'tok',
    })
    const fetchMock = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ fulfillment: { id: 5, status: 'success' } }),
      })
    ;(globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock

    const res = await adapter.pushFulfillment({
      platformOrderNo: '999',
      trackingNo: 'TN123',
      carrierName: 'DHL',
    })
    expect(res.success).toBe(true)
    expect(res.trackingNo).toBe('TN123')
    const init = fetchMock.mock.calls[0][1]
    const body = JSON.parse(init.body as string)
    expect(body.fulfillment.tracking_number).toBe('TN123')
  })
})

describe('ChannelSyncService.pullAndStore · SKU 映射回填（§1.7）', () => {
  /** 构造带 catalog 注入的拉单服务，验证平台 SKU→内部 skuId 回填 */
  function buildSync(catalogStub: { resolveByPlatformSku: jest.Mock }) {
    const mock = new MockChannelAdapter(new RetryableHttpService(), new AppLogger())
    const registry = new ChannelRegistryService()
    registry.registerAdapter(mock)
    const prisma = {
      shop: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's1', tenantId: 't1', platform: 'mock', name: 'Mock' }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }
    const sync = new ChannelSyncService(
      prisma as unknown as PrismaClient,
      registry,
      new AppLogger(),
      catalogStub as never,
    )
    return { sync, prisma }
  }

  it('命中平台 SKU 映射时回填 OrderItem.skuId', async () => {
    const catalogStub = { resolveByPlatformSku: jest.fn().mockResolvedValue({ id: 'skuX' }) }
    const { sync, prisma } = buildSync(catalogStub)

    await sync.pullAndStore('s1', {})
    const data = (prisma.orderItem.createMany as jest.Mock).mock.calls[0][0].data
    expect(data[0].skuId).toBe('skuX')
    expect(catalogStub.resolveByPlatformSku).toHaveBeenCalledWith('t1', 'SKU-RED-TEE')
  })

  it('未注入 CatalogService 时 skuId 留空，不阻断落库', async () => {
    const mock = new MockChannelAdapter(new RetryableHttpService(), new AppLogger())
    const registry = new ChannelRegistryService()
    registry.registerAdapter(mock)
    const prisma = {
      shop: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 's1', tenantId: 't1', platform: 'mock', name: 'Mock' }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'o1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    }
    const sync = new ChannelSyncService(
      prisma as unknown as PrismaClient,
      registry,
      new AppLogger(),
    )
    const summary = await sync.pullAndStore('s1', {})
    expect(summary.created).toBe(2)
    const data = (prisma.orderItem.createMany as jest.Mock).mock.calls[0][0].data
    expect(data[0].skuId).toBeNull()
  })
})
