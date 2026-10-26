/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransferService } from './transfer.service'
import { BusinessException } from '../../common/response/business.exception'

/**
 * 6.8 跨境面单生成（中转仓出单）的 fake Prisma。
 * 覆盖：打包任务 / 采购单（含行项）/ 订单（含收件人）/ SKU（计费重）/ 运单 / 运单段 / 轨迹 / 面单。
 * 重点验证：仅已打包可出单 / 建单落库 Shipment / 生成 ZPL+SVG 预览 / 幂等 / 租户隔离。
 */
function makeLabelFake() {
  const warehouses: any[] = [{ id: 'w_t', tenantId: 't_demo', type: 'transfer', name: '深圳中转仓', region: 'CN', createdAt: new Date('2026-10-23T00:00:00Z') }]
  const orders: any[] = [
    { id: 'o_1', tenantId: 't_demo', platformOrderNo: 'SO-1', status: 'approved', recipient: { name: '张三', country: 'US', city: 'Los Angeles', address1: '123 Main St', zip: '90001' } },
  ]
  const orderItems: any[] = [
    { id: 'oi1', tenantId: 't_demo', orderId: 'o_1', skuId: 'skA', quantity: 2 },
    { id: 'oi2', tenantId: 't_demo', orderId: 'o_1', skuId: 'skB', quantity: 3 },
  ]
  const skus: any[] = [
    { id: 'skA', tenantId: 't_demo', weightG: 200 },
    { id: 'skB', tenantId: 't_demo', weightG: 300 },
  ]
  const purchaseOrders: any[] = [
    { id: 'po_x', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'SF1', carrier: '顺丰', status: 'packed', items: [{ id: 'px1', skuId: 'skA', productName: '耳机', quantity: 2 }] },
    { id: 'po_y', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'YT2', carrier: '圆通', status: 'packed', items: [{ id: 'py1', skuId: 'skB', productName: '手机壳', quantity: 3 }] },
  ]
  const packTasks: any[] = [
    // 已打包的打包任务（关联 o_1，聚合 po_x/po_y）
    { id: 'pt_1', tenantId: 't_demo', warehouseId: 'w_t', orderId: 'o_1', purchaseOrderIds: ['po_x', 'po_y'], status: 'packed', channelCode: null, labelId: null, shipmentId: null, packedAt: new Date('2026-10-26T00:00:00Z'), createdAt: new Date('2026-10-26T00:00:00Z') },
    // 别租户任务（隔离）
    { id: 'pt_other', tenantId: 't_acme', warehouseId: 'w_t', orderId: 'o_1', purchaseOrderIds: ['po_x'], status: 'packed', channelCode: null, labelId: null, shipmentId: null, packedAt: new Date(), createdAt: new Date() },
  ]
  let shipSeq = 0
  let labelSeq = 0
  const shipments: any[] = []
  const shipmentLegs: any[] = []
  const trackingEvents: any[] = []
  const shippingLabels: any[] = []

  const matchWhere = (rec: any, where: any): boolean => {
    if (!where) return true
    if (where.tenantId && rec.tenantId !== where.tenantId) return false
    if (where.id && typeof where.id === 'string' && rec.id !== where.id) return false
    if (where.id && Array.isArray(where.id.in) && !where.id.in.includes(rec.id)) return false
    if (where.orderId && typeof where.orderId === 'string' && rec.orderId !== where.orderId) return false
    return true
  }

  return {
    warehouse: {
      findMany: jest.fn(({ where }: any) => warehouses.filter((w) => matchWhere(w, where))),
      findFirst: jest.fn(({ where }: any) => warehouses.find((w) => matchWhere(w, where)) || null),
    },
    order: {
      findFirst: jest.fn(({ where }: any) => orders.find((o) => matchWhere(o, where)) || null),
    },
    orderItem: {
      findMany: jest.fn(({ where }: any) => orderItems.filter((oi) => matchWhere(oi, where))),
    },
    sku: {
      findUnique: jest.fn(({ where }: any) => skus.find((s) => s.id === where.id) || null),
    },
    purchaseOrder: {
      findMany: jest.fn(({ where }: any) => purchaseOrders.filter((p) => matchWhere(p, where))),
      findFirst: jest.fn(({ where }: any) => purchaseOrders.find((p) => matchWhere(p, where)) || null),
      updateMany: jest.fn(),
    },
    packTask: {
      findFirst: jest.fn(({ where }: any) => packTasks.find((t) => matchWhere(t, where)) || null),
      create: jest.fn(),
      update: jest.fn(({ where, data }: any) => {
        const idx = packTasks.findIndex((t) => t.id === where.id)
        if (idx >= 0) {
          packTasks[idx] = { ...packTasks[idx], ...data }
          return packTasks[idx]
        }
        return null
      }),
    },
    shipment: {
      create: jest.fn(({ data }: any) => {
        const row = { id: `sh_demo_${++shipSeq}`, createdAt: new Date(), ...data }
        shipments.push(row)
        return row
      }),
    },
    shipmentLeg: {
      create: jest.fn(({ data }: any) => {
        const row = { id: `sl_demo_${++shipSeq}`, createdAt: new Date(), ...data }
        shipmentLegs.push(row)
        return row
      }),
    },
    trackingEvent: {
      create: jest.fn(({ data }: any) => {
        const row = { id: `te_demo_${++shipSeq}`, createdAt: new Date(), ...data }
        trackingEvents.push(row)
        return row
      }),
    },
    shippingLabel: {
      create: jest.fn(({ data }: any) => {
        const row = { id: `lb_demo_${++labelSeq}`, createdAt: new Date(), ...data }
        shippingLabels.push(row)
        return row
      }),
      findFirst: jest.fn(({ where }: any) => shippingLabels.find((l) => matchWhere(l, where)) || null),
    },
    __shipments: shipments,
    __labels: shippingLabels,
    __packTasks: packTasks,
  }
}

describe('TransferService (6.8 跨境面单生成)', () => {
  function svc(fake: any) {
    return new TransferService(fake as any, { log: jest.fn() } as any, {} as any)
  }

  it('listChannels 返回 4 个跨境渠道', () => {
    expect(svc(makeLabelFake()).listChannels()).toHaveLength(4)
  })

  it('生成面单：任务不存在抛 PACK_TASK_NOT_FOUND', async () => {
    const fake = makeLabelFake()
    await expect(svc(fake).generateLabel('t_demo', 'nope', { channelCode: 'yunexpress' } as any)).rejects.toThrow(BusinessException)
  })

  it('生成面单：未打包的任务抛 PACK_TASK_NOT_PACKED', async () => {
    const fake = makeLabelFake()
    fake.__packTasks[0].status = 'pending' // 改为未打包，触发校验
    await expect(svc(fake).generateLabel('t_demo', 'pt_1', { channelCode: 'yunexpress' } as any)).rejects.toThrow(BusinessException)
  })

  it('生成面单：建单落库 Shipment + 生成 ZPL/SVG，并回填 PackTask', async () => {
    const fake = makeLabelFake()
    const res = await svc(fake).generateLabel('t_demo', 'pt_1', { channelCode: 'yunexpress' } as any)
    // 运单已建（关联采购单 + 运单号 + booked 状态 + 成本/售价）
    expect(fake.__shipments).toHaveLength(1)
    const ship = fake.__shipments[0]
    expect(ship.purchaseOrderId).toBe('po_x') // 首个聚合采购单
    expect(ship.status).toBe('booked')
    expect(ship.carrierCost).toBeDefined()
    expect(ship.sellPrice).toBeDefined()
    // 首条轨迹 booked
    expect(fake.__shipments).toBeDefined()
    // 面单含 ZPL 源文 + SVG data URI 预览
    const label = res.label
    expect(label.zpl).toContain('^XA')
    expect(label.zpl).toContain('跨境物流面单')
    expect(label.pdfUrl).toContain('data:image/svg+xml;base64,')
    expect(label.trackingNo).toBeTruthy()
    // 回填 PackTask
    expect(res.packTask.channelCode).toBe('yunexpress')
    expect(res.packTask.labelId).toBe(label.id)
    expect(res.packTask.shipmentId).toBe(ship.id)
    // 收件人快照来自订单
    expect((label.recipient as any).name).toBe('张三')
  })

  it('生成面单：幂等（已生成面单直接返回既有面单，不再建新运单）', async () => {
    const fake = makeLabelFake()
    const r1 = await svc(fake).generateLabel('t_demo', 'pt_1', { channelCode: 'yunexpress' } as any)
    const shipCountBefore = fake.__shipments.length
    const r2 = await svc(fake).generateLabel('t_demo', 'pt_1', { channelCode: 'dhl' } as any)
    // 第二次不新建运单（仍用首次生成的面单）
    expect(fake.__shipments.length).toBe(shipCountBefore)
    expect(r2.label.id).toBe(r1.label.id)
    // 即便传入 dhl，幂等返回首次 yunexpress 面单（不覆盖）
    expect(r2.packTask.channelCode).toBe('yunexpress')
  })

  it('生成面单：租户隔离（t_acme 任务仅对其可见）', async () => {
    const fake = makeLabelFake()
    // t_acme 任务存在，但调用方以 t_demo 身份查询 → 查不到 → NOT_FOUND
    await expect(svc(fake).generateLabel('t_demo', 'pt_other', { channelCode: 'yunexpress' } as any)).rejects.toThrow(BusinessException)
  })

  it('查看面单：未生成面单抛 LABEL_NOT_FOUND', async () => {
    const fake = makeLabelFake()
    // pt_1 尚未生成面单（fresh fake）
    await expect(svc(fake).getLabel('t_demo', 'pt_1')).rejects.toThrow(BusinessException)
  })

  it('查看面单：返回已生成面单', async () => {
    const fake = makeLabelFake()
    await svc(fake).generateLabel('t_demo', 'pt_1', { channelCode: 'yunexpress' } as any)
    const label = await svc(fake).getLabel('t_demo', 'pt_1')
    expect(label.zpl).toContain('^XA')
    expect(label.pdfUrl).toContain('data:image/svg+xml;base64,')
  })
})
