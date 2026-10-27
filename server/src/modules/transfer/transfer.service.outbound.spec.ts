/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransferService } from './transfer.service'
import { BusinessException } from '../../common/response/business.exception'

/**
 * 6.9 出库闭环（中转仓出库 + 物流同步）的 fake Prisma + fake ShipmentsService。
 * 重点验证：出库定位（打包任务 / 运单）→ 回写平台(pushed) → 出库揽收(picked_up) →
 * 采购单 packed→outbound → 关联订单状态机贯通 → 返回完整轨迹时间线。
 */
function makeOutboundFake() {
  const warehouses: any[] = [
    { id: 'w_t', tenantId: 't_demo', type: 'transfer', name: '深圳中转仓', region: 'CN', createdAt: new Date('2026-10-23T00:00:00Z') },
  ]
  const orders: any[] = [
    {
      id: 'o_1',
      tenantId: 't_demo',
      platformOrderNo: 'SO-1',
      status: 'approved', // 已审通过（出库回传将推进至 pushed→picked_up）
      recipient: { name: '张三', country: 'US', city: 'Los Angeles', address1: '123 Main St', zip: '90001' },
    },
  ]
  const purchaseOrders: any[] = [
    { id: 'po_x', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'SF1', carrier: '顺丰', status: 'packed', items: [] },
    { id: 'po_y', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'YT2', carrier: '圆通', status: 'packed', items: [] },
  ]
  const packTasks: any[] = [
    // 已打包且已出单（labelId/shipmentId 就绪）
    {
      id: 'pt_1',
      tenantId: 't_demo',
      warehouseId: 'w_t',
      orderId: 'o_1',
      purchaseOrderIds: ['po_x', 'po_y'],
      status: 'packed',
      channelCode: 'yunexpress',
      labelId: 'lb_1',
      shipmentId: 'sh_1',
      packedAt: new Date('2026-10-26T00:00:00Z'),
      createdAt: new Date('2026-10-26T00:00:00Z'),
    },
    // 未出单（无面单）：出库应被拦截
    {
      id: 'pt_nolabel',
      tenantId: 't_demo',
      warehouseId: 'w_t',
      orderId: 'o_1',
      purchaseOrderIds: ['po_x'],
      status: 'packed',
      channelCode: null,
      labelId: null,
      shipmentId: null,
      packedAt: null,
      createdAt: new Date('2026-10-26T00:00:00Z'),
    },
    // 别租户任务（隔离）
    {
      id: 'pt_other',
      tenantId: 't_acme',
      warehouseId: 'w_t',
      orderId: 'o_1',
      purchaseOrderIds: ['po_x'],
      status: 'packed',
      channelCode: 'dhl',
      labelId: 'lb_9',
      shipmentId: 'sh_9',
      packedAt: new Date(),
      createdAt: new Date(),
    },
  ]
  const shipments: any[] = [
    { id: 'sh_1', tenantId: 't_demo', orderId: 'o_1', purchaseOrderId: 'po_x', trackingNo: 'TRK-OUT-1', status: 'booked', carrierCost: 60, sellPrice: 69, legs: [] },
  ]
  const shippingLabels: any[] = [{ id: 'lb_1', tenantId: 't_demo', packTaskId: 'pt_1', shipmentId: 'sh_1', channelCode: 'yunexpress' }]
  const trackingEvents: any[] = [
    // 6.8 出单时已写入的「已建单」轨迹
    { id: 'te_booked', shipmentId: 'sh_1', legType: 'direct', status: 'booked', location: '中转仓', description: '已建单', occurredAt: new Date('2026-10-27T08:00:00Z') },
  ]

  const matchWhere = (rec: any, where: any): boolean => {
    if (!where) return true
    if (where.tenantId && rec.tenantId !== where.tenantId) return false
    if (where.id && typeof where.id === 'string' && rec.id !== where.id) return false
    if (where.id && Array.isArray(where.id.in) && !where.id.in.includes(rec.id)) return false
    return true
  }

  const fake = {
    warehouse: {
      findMany: jest.fn(({ where }: any) => warehouses.filter((w) => matchWhere(w, where))),
      findFirst: jest.fn(({ where }: any) => warehouses.find((w) => matchWhere(w, where)) || null),
    },
    order: {
      findFirst: jest.fn(({ where }: any) => orders.find((o) => matchWhere(o, where)) || null),
      update: jest.fn(({ where, data }: any) => {
        const o = orders.find((x) => x.id === where.id)
        if (o) Object.assign(o, data)
        return o
      }),
    },
    purchaseOrder: {
      findMany: jest.fn(({ where }: any) => purchaseOrders.filter((p) => matchWhere(p, where))),
      findFirst: jest.fn(({ where }: any) => purchaseOrders.find((p) => matchWhere(p, where)) || null),
      updateMany: jest.fn(({ where, data }: any) => {
        let n = 0
        for (const p of purchaseOrders) {
          if (where.id?.in?.includes(p.id) && p.tenantId === where.tenantId && p.status === where.status) {
            Object.assign(p, data)
            n++
          }
        }
        return { count: n }
      }),
    },
    packTask: {
      findFirst: jest.fn(({ where }: any) => packTasks.find((t) => matchWhere(t, where)) || null),
    },
    shipment: {
      findFirst: jest.fn(({ where }: any) => shipments.find((s) => matchWhere(s, where)) || null),
    },
    shippingLabel: {
      findFirst: jest.fn(({ where }: any) => shippingLabels.find((l) => matchWhere(l, where)) || null),
    },
    __shipments: shipments,
    __orders: orders,
    __pos: purchaseOrders,
    __tracking: trackingEvents,
  }

  // fake ShipmentsService：回写平台 + 追加轨迹，并就地推进订单状态（best-effort，演示 6.9 状态机贯通）
  const shipFake = {
    fulfill: jest.fn(async (id: string, _tenant: string) => {
      const s = shipments.find((x) => x.id === id)
      if (s) {
        s.status = 'pushed'
        trackingEvents.push({ id: `te_${trackingEvents.length}`, shipmentId: id, legType: 'direct', status: 'pushed', location: '渠道回传', description: '已回传平台', occurredAt: new Date('2026-10-27T09:00:00Z') })
        const o = orders.find((x) => x.id === s.orderId)
        if (o && o.status === 'approved') o.status = 'pushed'
      }
      return { success: true, message: 'ok' }
    }),
    recordTracking: jest.fn(async (dto: any, _tenant: string) => {
      const s = shipments.find((x) => x.id === dto.shipmentId)
      if (s) {
        s.status = dto.status
        trackingEvents.push({ id: `te_${trackingEvents.length}`, shipmentId: dto.shipmentId, legType: 'direct', status: dto.status, location: dto.location, description: dto.description, occurredAt: new Date('2026-10-27T10:00:00Z') })
        const o = orders.find((x) => x.id === s.orderId)
        if (o && o.status === 'pushed') o.status = 'picked_up'
      }
      return { id: `te_${trackingEvents.length}`, shipmentId: dto.shipmentId, status: dto.status, occurredAt: new Date().toISOString() }
    }),
    listTracking: jest.fn(async (id: string, _tenant: string) =>
      trackingEvents
        .filter((e) => e.shipmentId === id)
        .sort((a, b) => a.occurredAt.getTime?.() - b.occurredAt.getTime?.() || 0)
        .map((e) => ({ id: e.id, shipmentId: e.shipmentId, legType: e.legType, status: e.status, location: e.location, description: e.description, occurredAt: e.occurredAt.toISOString() })),
    ),
  }

  return { fake, shipFake }
}

function svc(fake: any, shipFake: any) {
  return new TransferService(fake as any, { log: jest.fn() } as any, {} as any, shipFake as any)
}

describe('TransferService (6.9 出库闭环 + 物流同步)', () => {
  it('出库成功：回写平台(pushed)→出库揽收(picked_up)，采购单 packed→outbound，关联订单贯通', async () => {
    const { fake, shipFake } = makeOutboundFake()
    const res = await svc(fake, shipFake).outbound('t_demo', { packTaskId: 'pt_1' })

    // 运单已揽收
    expect(res.shipment.trackingNo).toBe('TRK-OUT-1')
    expect(res.shipment.status).toBe('picked_up')
    // 完整轨迹时间线：booked → pushed → picked_up
    expect(res.tracking.map((t: any) => t.status)).toEqual(['booked', 'pushed', 'picked_up'])
    // 采购单离仓
    expect(res.purchaseOrder.every((p: any) => p.status === 'outbound')).toBe(true)
    // 关联订单状态机贯通至 picked_up
    expect(res.order?.status).toBe('picked_up')
    // 打包任务渠道回填保留
    expect(res.packTask?.channelCode).toBe('yunexpress')
    // ShipmentsService 被调用（fulfill + recordTracking）
    expect(shipFake.fulfill).toHaveBeenCalledWith('sh_1', 't_demo')
    expect(shipFake.recordTracking).toHaveBeenCalled()
  })

  it('出库：直接指定 shipmentId（不经由打包任务）亦可出库', async () => {
    const { fake, shipFake } = makeOutboundFake()
    const res = await svc(fake, shipFake).outbound('t_demo', { shipmentId: 'sh_1' })
    expect(res.shipment.status).toBe('picked_up')
    expect(res.tracking.map((t: any) => t.status)).toEqual(['booked', 'pushed', 'picked_up'])
  })

  it('出库：未出单任务（无面单）抛 OUTBOUND_NO_LABEL', async () => {
    const { fake, shipFake } = makeOutboundFake()
    await expect(svc(fake, shipFake).outbound('t_demo', { packTaskId: 'pt_nolabel' })).rejects.toThrow(BusinessException)
  })

  it('出库：未提供任何定位标识抛 OUTBOUND_TARGET_REQUIRED', async () => {
    const { fake, shipFake } = makeOutboundFake()
    await expect(svc(fake, shipFake).outbound('t_demo', {})).rejects.toThrow(BusinessException)
  })

  it('出库：打包任务不存在抛 PACK_TASK_NOT_FOUND', async () => {
    const { fake, shipFake } = makeOutboundFake()
    await expect(svc(fake, shipFake).outbound('t_demo', { packTaskId: 'nope' })).rejects.toThrow(BusinessException)
  })

  it('出库：租户隔离（t_acme 任务对 t_demo 不可见）抛 PACK_TASK_NOT_FOUND', async () => {
    const { fake, shipFake } = makeOutboundFake()
    await expect(svc(fake, shipFake).outbound('t_demo', { packTaskId: 'pt_other' })).rejects.toThrow(BusinessException)
  })

  it('出库：仅已 packed 的采购单被推进为 outbound（已离仓的不重复推进）', async () => {
    const { fake, shipFake } = makeOutboundFake()
    // 先把 po_x 设为非 packed，验证 updateMany 只动 packed 的
    fake.__pos[0].status = 'arrived'
    await svc(fake, shipFake).outbound('t_demo', { packTaskId: 'pt_1' })
    expect(fake.__pos[0].status).toBe('arrived') // 未被改写
    expect(fake.__pos[1].status).toBe('outbound') // packed → outbound
  })
})
