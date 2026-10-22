/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 物流回传与轨迹服务测（任务 1.6，方案 §3 推单回传 / §6 轨迹与异常）。
 * 用进程内内存桩模拟 Prisma 与各依赖，覆盖建单/回传/轨迹推进/查询。
 */

import { ShipmentsService } from './shipments.service'
import { BusinessException } from '../../common/response/business.exception'

// ---- 测试数据 ----------------------------------------------------------

const CARRIERS = [{ id: 'c_mock', code: 'mock', name: 'Mock Carrier' }]
const SHOPS = [{ id: 's1', tenantId: 't1', platform: 'mock', name: 'Mock Shop', authConfig: null }]
const SKUS = [{ id: 'sk1', tenantId: 't1', code: 'SK-1', weightG: 2000, lengthCm: 30, widthCm: 20, heightCm: 10 }]
const ORDERS = [
  {
    id: 'o1',
    tenantId: 't1',
    shopId: 's1',
    platformOrderNo: 'PO-1',
    status: 'approved',
    recipient: { name: 'A', country: 'US', city: 'LA', address1: '1 St' },
    selectedQuoteId: null,
    items: [{ id: 'oi1', tenantId: 't1', orderId: 'o1', skuId: 'sk1', quantity: 1, price: null }],
  },
]

// ---- 内存桩 ------------------------------------------------------------

function makeStore<T extends Record<string, any>>(rows: T[]): { all: T[] } {
  return { all: rows.map((r) => ({ ...r })) }
}

function resolveInclude(model: string, row: any, include: any, ctx: any): any {
  if (!include) return row
  if (include.order && ctx.orders) {
    row.order = ctx.orders.all.find((o: any) => o.id === row.orderId)
    if (row.order && include.order.include?.shop && ctx.shops) {
      row.order.shop = ctx.shops.all.find((s: any) => s.id === row.order.shopId) ?? null
    }
  }
  if (include.items && ctx.orderItems) {
    row.items = ctx.orderItems.all
      .filter((oi: any) => oi.orderId === row.id)
      .map((oi: any) => {
        if (include.items.include?.sku && ctx.skus) {
          oi.sku = ctx.skus.all.find((k: any) => k.id === oi.skuId) ?? null
        }
        return oi
      })
  }
  if (include.legs && ctx.shipmentLegs) {
    row.legs = ctx.shipmentLegs.all.filter((l: any) => l.shipmentId === row.id)
  }
  return row
}

function matchWhere(row: any, where: any): boolean {
  if (!where) return true
  return Object.keys(where).every((k) => row[k] === where[k])
}

function makePrismaStub() {
  const carriers = makeStore<any>(CARRIERS.map((c) => ({ ...c })))
  const shops = makeStore<any>(SHOPS.map((s) => ({ ...s })))
  const skus = makeStore<any>(SKUS.map((k) => ({ ...k })))
  const orders = makeStore<any>(ORDERS.map((o) => ({ ...o })))
  const orderItems = makeStore<any>(ORDERS.flatMap((o) => (o.items ?? []).map((i: any) => ({ ...i }))))
  const shipments = makeStore<any>([])
  const shipmentLegs = makeStore<any>([])
  const trackingEvents = makeStore<any>([])
  let seq = 1000

  const ctx = { carriers, shops, skus, orders, orderItems, shipments, shipmentLegs, trackingEvents }

  const idFor = () => `id_${++seq}`

  const prisma: any = {
    carrier: {
      findUnique: async ({ where }: any) =>
        carriers.all.find((c) => Object.keys(where).every((k) => c[k] === where[k])) ?? null,
      findMany: async () => carriers.all.map((c) => ({ ...c })),
    },
    shop: {
      findUnique: async ({ where }: any) =>
        shops.all.find((s) => Object.keys(where).every((k) => s[k] === where[k])) ?? null,
    },
    sku: {
      findUnique: async ({ where }: any) =>
        skus.all.find((k) => Object.keys(where).every((k2) => k[k2] === where[k2])) ?? null,
    },
    order: {
      findFirst: async ({ where, include }: any) => {
        const row = orders.all.find((o) => matchWhere(o, where))
        return row ? resolveInclude('order', { ...row }, include, ctx) : null
      },
      findUnique: async ({ where, include }: any) => {
        const row = orders.all.find((o) => matchWhere(o, where))
        return row ? resolveInclude('order', { ...row }, include, ctx) : null
      },
    },
    orderItem: {
      findMany: async ({ where }: any) =>
        orderItems.all.filter((oi) => matchWhere(oi, where)).map((o) => ({ ...o })),
    },
    shipment: {
      create: async ({ data }: any) => {
        const rec = { id: idFor(), createdAt: new Date(), ...data }
        if (rec.carrierCost && typeof rec.carrierCost.toNumber === 'function') rec.carrierCost = rec.carrierCost.toNumber()
        if (rec.sellPrice && typeof rec.sellPrice.toNumber === 'function') rec.sellPrice = rec.sellPrice.toNumber()
        shipments.all.push(rec)
        return rec
      },
      findUnique: async ({ where, include }: any) => {
        const row = shipments.all.find((s) => matchWhere(s, where))
        return row ? resolveInclude('shipment', { ...row }, include, ctx) : null
      },
      findFirst: async ({ where, include }: any) => {
        const row = shipments.all.find((s) => matchWhere(s, where))
        return row ? resolveInclude('shipment', { ...row }, include, ctx) : null
      },
      findMany: async ({ where, include, orderBy }: any) => {
        let rows = shipments.all.filter((s) => matchWhere(s, where))
        if (orderBy) {
          const key = Object.keys(orderBy)[0]
          const dir = orderBy[key]
          rows = [...rows].sort((a, b) => {
            const av = new Date(a[key]).getTime()
            const bv = new Date(b[key]).getTime()
            return dir === 'desc' ? bv - av : av - bv
          })
        }
        return rows.map((r) => resolveInclude('shipment', { ...r }, include, ctx))
      },
      update: async ({ where, data }: any) => {
        const row = shipments.all.find((s) => matchWhere(s, where))
        if (!row) return null
        Object.assign(row, data)
        return row
      },
    },
    shipmentLeg: {
      create: async ({ data }: any) => {
        const rec = { id: idFor(), ...data }
        shipmentLegs.all.push(rec)
        return rec
      },
      findMany: async ({ where, orderBy }: any) => {
        let rows = shipmentLegs.all.filter((l) => matchWhere(l, where))
        if (orderBy) {
          const key = Object.keys(orderBy)[0]
          const dir = orderBy[key]
          rows = [...rows].sort((a, b) => {
            const av = new Date(a[key]).getTime()
            const bv = new Date(b[key]).getTime()
            return dir === 'desc' ? bv - av : av - bv
          })
        }
        return rows.map((r) => ({ ...r }))
      },
    },
    trackingEvent: {
      create: async ({ data }: any) => {
        const rec = { id: idFor(), ...data }
        trackingEvents.all.push(rec)
        return rec
      },
      findMany: async ({ where, orderBy }: any) => {
        let rows = trackingEvents.all.filter((e) => matchWhere(e, where))
        if (orderBy) {
          const key = Object.keys(orderBy)[0]
          const dir = orderBy[key]
          rows = [...rows].sort((a, b) => {
            const av = new Date(a[key]).getTime()
            const bv = new Date(b[key]).getTime()
            return dir === 'desc' ? bv - av : av - bv
          })
        }
        return rows.map((r) => ({ ...r }))
      },
    },
  }
  return prisma
}

// ---- 依赖桩 ------------------------------------------------------------

function makeDeps() {
  const prisma = makePrismaStub()
  const carriers: any = {
    ship: jest.fn().mockResolvedValue({
      waybillNo: 'WB1',
      trackingNo: 'TRK1',
      carrierCost: 12.5,
      currency: 'USD',
      estimatedLeadDays: 6,
    }),
  }
  const channels: any = {
    resolveForShop: jest.fn().mockReturnValue({
      pushFulfillment: jest.fn().mockResolvedValue({ platformOrderNo: 'PO-1', success: true, message: 'ok' }),
    }),
  }
  const orderSM: any = {
    transition: jest.fn().mockResolvedValue({ changed: true }),
  }
  const logger: any = { log() {}, warn() {}, error() {}, debug() {}, info() {} }
  const svc = new ShipmentsService(prisma, carriers, channels, orderSM, logger)
  return { prisma, carriers, channels, orderSM, svc }
}

// ---- 用例 --------------------------------------------------------------

describe('ShipmentsService (1.6 物流回传+轨迹)', () => {
  it('book: 建单落库 Shipment + Leg + 首条轨迹', async () => {
    const { carriers, svc } = makeDeps()
    const vo = await svc.book({ orderId: 'o1', carrierCode: 'mock' }, 't1')
    expect(carriers.ship).toHaveBeenCalled()
    expect(vo.trackingNo).toBe('TRK1')
    expect(vo.status).toBe('booked')
    expect(vo.carrierName).toBe('Mock Carrier')
    expect(vo.legs.length).toBe(1)
    expect(vo.legs[0].trackingNo).toBe('TRK1')
  })

  it('book: 订单不存在应抛错', async () => {
    const { svc } = makeDeps()
    await expect(svc.book({ orderId: 'nope' }, 't1')).rejects.toBeInstanceOf(BusinessException)
  })

  it('fulfill: 回传平台并推进订单状态', async () => {
    const { channels, orderSM, svc } = makeDeps()
    const vo = await svc.book({ orderId: 'o1', carrierCode: 'mock' }, 't1')
    const res = await svc.fulfill(vo.id, 't1')
    expect(res.success).toBe(true)
    expect(channels.resolveForShop).toHaveBeenCalled()
    expect(orderSM.transition).toHaveBeenCalledWith('o1', 'pushed', 'shipments.fulfill')
  })

  it('recordTracking: 写入节点并映射推进订单状态', async () => {
    const { orderSM, svc } = makeDeps()
    const vo = await svc.book({ orderId: 'o1', carrierCode: 'mock' }, 't1')
    await svc.fulfill(vo.id, 't1')
    const evt = await svc.recordTracking({ shipmentId: vo.id, status: 'in_transit', location: 'LA' }, 't1')
    expect(evt.status).toBe('in_transit')
    expect(orderSM.transition).toHaveBeenCalledWith('o1', 'in_transit', 'tracking')
  })

  it('listTracking: 按发生时间升序返回轨迹', async () => {
    const { svc } = makeDeps()
    const vo = await svc.book({ orderId: 'o1', carrierCode: 'mock' }, 't1')
    await svc.recordTracking({ shipmentId: vo.id, status: 'picked_up', occurredAt: '2026-10-22T10:00:00.000Z' }, 't1')
    await svc.recordTracking({ shipmentId: vo.id, status: 'in_transit', occurredAt: '2026-10-22T12:00:00.000Z' }, 't1')
    const list = await svc.listTracking(vo.id, 't1')
    expect(list.length).toBeGreaterThanOrEqual(3) // booked + picked_up + in_transit
    expect(new Date(list[0].occurredAt).getTime()).toBeLessThanOrEqual(new Date(list[1].occurredAt).getTime())
  })

  it('list: 租户隔离过滤', async () => {
    const { svc } = makeDeps()
    await svc.book({ orderId: 'o1', carrierCode: 'mock' }, 't1')
    const list = await svc.list('t1')
    expect(list.length).toBe(1)
    const empty = await svc.list('other-tenant')
    expect(empty.length).toBe(0)
  })
})
