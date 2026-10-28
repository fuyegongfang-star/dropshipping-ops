/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransferService } from './transfer.service'
import { BusinessException } from '../../common/response/business.exception'

/** 构造最小可用 fake Prisma（仅覆盖 getBoard 用到的仓储） */
function makeFakePrisma() {
  const warehouses: any[] = [
    { id: 'w_transfer', tenantId: 't_demo', name: '深圳中转仓', type: 'transfer', region: 'CN', createdAt: new Date('2026-10-23T00:00:00Z') },
    { id: 'w_overseas', tenantId: 't_demo', name: 'US-West 海外仓', type: 'overseas', region: 'US', createdAt: new Date('2026-10-22T00:00:00Z') },
    { id: 'w_other', tenantId: 't_acme', name: '别家的中转仓', type: 'transfer', region: 'CN', createdAt: new Date('2026-10-20T00:00:00Z') },
  ]
  const orders: any[] = [
    { id: 'o_1', tenantId: 't_demo', platformOrderNo: 'SO-10001', status: 'approved', recipient: { name: 'John Doe' } },
    { id: 'o_2', tenantId: 't_acme', platformOrderNo: 'P999', status: 'approved', recipient: { name: '李四' } },
  ]
  // 待作业采购单：arrived/matched/packed 计入；pending/outbound 排除
  const purchaseOrders: any[] = [
    { id: 'po_a', tenantId: 't_demo', shopId: 's_1', orderId: 'o_1', trackingNo: 'SF1', carrier: '顺丰', platformOrderNo: 'SO-10001', recipientName: 'John Doe', status: 'arrived', items: [{ id: 'pi_a', productName: '耳机', quantity: 2, skuId: 'sk1' }] },
    { id: 'po_m', tenantId: 't_demo', shopId: 's_1', orderId: null, trackingNo: 'YT2', carrier: '圆通', platformOrderNo: null, recipientName: null, status: 'matched', items: [] },
    { id: 'po_p', tenantId: 't_demo', shopId: null, orderId: null, trackingNo: 'JD3', carrier: '京东', platformOrderNo: null, recipientName: null, status: 'packed', items: [] },
    { id: 'po_pending', tenantId: 't_demo', shopId: null, orderId: null, trackingNo: 'XX', carrier: 'x', platformOrderNo: null, recipientName: null, status: 'pending', items: [] },
    { id: 'po_out', tenantId: 't_demo', shopId: null, orderId: 'o_1', trackingNo: 'YY', carrier: 'y', platformOrderNo: null, recipientName: null, status: 'outbound', items: [] },
    { id: 'po_other', tenantId: 't_acme', shopId: null, orderId: null, trackingNo: 'ZZ', carrier: 'z', platformOrderNo: null, recipientName: null, status: 'arrived', items: [] },
  ]
  return {
    warehouse: {
      findMany: jest.fn(({ where }: any) =>
        warehouses.filter((w) => (!where?.tenantId || w.tenantId === where.tenantId) && (!where?.type || w.type === where.type)),
      ),
    },
    purchaseOrder: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn(({ where, include }: any) =>
        purchaseOrders
          .filter((p) => (!where?.tenantId || p.tenantId === where.tenantId))
          .filter((p) => !where?.status?.in || where.status.in.includes(p.status))
          .map((p) => (include?.items ? p : p)),
      ),
    },
    order: {
      findMany: jest.fn(({ where }: any) =>
        orders.filter((o) => (!where?.tenantId || o.tenantId === where.tenantId) && (!where?.id?.in || where.id.in.includes(o.id))),
      ),
    },
  }
}

describe('TransferService (6.5 中转仓看板)', () => {
  let svc: TransferService
  beforeEach(() => {
    svc = new TransferService(makeFakePrisma() as any, { log: jest.fn() } as any, {} as any)
  })

  it('看板仅含本租户中转仓（排除海外仓与别租户中转仓）', async () => {
    const board = await svc.getBoard('t_demo')
    expect(board.warehouses.map((w) => w.id)).toEqual(['w_transfer'])
    expect(board.stats.transferWarehouseCount).toBe(1)
  })

  it('看板仅含待作业采购单（arrived/matched/packed，排除 pending 与 outbound）', async () => {
    const board = await svc.getBoard('t_demo')
    expect(board.purchaseOrders.map((p) => p.id).sort()).toEqual(['po_a', 'po_m', 'po_p'])
    expect(board.stats.pendingPoCount).toBe(3)
  })

  it('看板带关联订单概览（同租户，含收件人）', async () => {
    const board = await svc.getBoard('t_demo')
    const poA = board.purchaseOrders.find((p) => p.id === 'po_a')!
    expect(poA.order).not.toBeNull()
    expect(poA.order!.platformOrderNo).toBe('SO-10001')
    expect(poA.order!.recipientName).toBe('John Doe')
    const poM = board.purchaseOrders.find((p) => p.id === 'po_m')!
    expect(poM.order).toBeNull() // 无关联订单
  })

  it('状态统计按待作业状态聚合', async () => {
    const board = await svc.getBoard('t_demo')
    expect(board.stats.byStatus).toEqual({ arrived: 1, matched: 1, packed: 1 })
  })
})

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('TransferService (6.6 扫码到货入库)', () => {
  function makeScanFakePrisma() {
    const warehouses = [
      { id: 'w_t1', tenantId: 't_demo', name: '深圳中转仓', type: 'transfer', region: 'CN', createdAt: new Date() },
    ]
    const purchaseOrders: any[] = [
      // po_1：pending，无关联订单 → 扫码后推进 arrived 并尝试自动匹配
      { id: 'po_1', tenantId: 't_demo', trackingNo: 'SF123', carrier: '顺丰', status: 'pending', orderId: null, items: [{ id: 'pi1', productName: '耳机', quantity: 2, skuId: 'sk1', imageUrl: null }] },
      // po_2：已 arrived，已关联订单 → 扫码后不重复推进，matched=true
      { id: 'po_2', tenantId: 't_demo', trackingNo: 'YT456', carrier: '圆通', status: 'arrived', orderId: 'o_x', items: [{ id: 'pi2', productName: '手机壳', quantity: 1, skuId: 'sk2', imageUrl: null }] },
      // po_3：pending，由 SKU 条码 sk9 反查得到
      { id: 'po_3', tenantId: 't_demo', trackingNo: 'JD789', carrier: '京东', status: 'pending', orderId: null, items: [{ id: 'pi3', productName: '数据线', quantity: 3, skuId: 'sk9', imageUrl: null }] },
    ]
    const purchaseOrderItems = [
      { id: 'poi1', skuId: 'sk9', purchaseOrder: { id: 'po_3', tenantId: 't_demo' } },
    ]
    const createdAsns: any[] = []
    return {
      warehouse: {
        findFirst: jest.fn(({ where }: any) => warehouses.find((w) => w.id === where.id && w.tenantId === where.tenantId) || null),
      },
      sku: {
        // 仅支撑「商品条码 → SKU → 采购单」反查分支：扫出的条码对应 skuId='sk9'
        findFirst: jest.fn(({ where }: any) =>
          where?.barcode === 'sk9' ? { id: 'sk9' } : null,
        ),
      },
      purchaseOrder: {
        findFirst: jest.fn(({ where }: any) =>
          purchaseOrders.find((p) => {
            if (where.tenantId && p.tenantId !== where.tenantId) return false
            if (where.trackingNo !== undefined && p.trackingNo !== where.trackingNo) return false
            if (where.id !== undefined && p.id !== where.id) return false
            return true
          }) || null,
        ),
        update: jest.fn(({ where, data }: any) => {
          const idx = purchaseOrders.findIndex((p) => p.id === where.id)
          if (idx >= 0) {
            purchaseOrders[idx] = { ...purchaseOrders[idx], ...data }
            return purchaseOrders[idx]
          }
          return null
        }),
      },
      purchaseOrderItem: {
        findFirst: jest.fn(({ where }: any) => purchaseOrderItems.find((i) => i.skuId === where.skuId) || null),
      },
      asn: {
        create: jest.fn(({ data }: any) => {
          const asn = { id: 'asn_1', ...data, createdAt: new Date() }
          createdAsns.push(asn)
          return asn
        }),
      },
      __createdAsns: createdAsns,
      __getPos: () => purchaseOrders,
    }
  }

  function makePoService(autoMatchImpl?: (tenantId: string, poId: string) => any) {
    return {
      autoMatch: jest.fn((tenantId: string, poId: string) =>
        autoMatchImpl
          ? autoMatchImpl(tenantId, poId)
          : { linked: false, orderId: null, reasons: [], message: 'no candidate' },
      ),
    }
  }

  it('快递单号扫码：生成 ASN + 推进 pending→arrived + 调用自动匹配', async () => {
    const fake = makeScanFakePrisma() as any
    const poSvc = makePoService()
    const svc = new TransferService(fake, { log: jest.fn() } as any, poSvc as any)
    const res = await svc.scan('t_demo', { warehouseId: 'w_t1', scanValue: 'SF123', scanType: 'trackingNo' })
    expect(fake.asn.create).toHaveBeenCalledTimes(1)
    expect(fake.__createdAsns[0].purchaseOrderId).toBe('po_1')
    expect(fake.__createdAsns[0].scanSource).toBe('trackingNo')
    expect(fake.__createdAsns[0].status).toBe('received')
    expect(res.advanced).toBe(true)
    expect(res.purchaseOrder.status).toBe('arrived')
    expect(poSvc.autoMatch).toHaveBeenCalledWith('t_demo', 'po_1')
  })

  it('自动匹配成功：回填 orderId 并标记 matched', async () => {
    const fake = makeScanFakePrisma() as any
    // 模拟 autoMatch 关联订单并回写 mock 采购单
    const poSvc = makePoService((_t: string, poId: string) => {
      fake.__getPos().find((p: any) => p.id === poId).orderId = 'o_new'
      return { linked: true, orderId: 'o_new', reasons: ['平台订单号一致'], message: 'matched' }
    })
    const svc = new TransferService(fake, { log: jest.fn() } as any, poSvc as any)
    const res = await svc.scan('t_demo', { warehouseId: 'w_t1', scanValue: 'SF123', scanType: 'trackingNo' })
    expect(res.matched).toBe(true)
    expect(res.purchaseOrder.orderId).toBe('o_new')
  })

  it('已 arrived 采购单重复扫码：不重复推进状态，matched 由已有订单标记', async () => {
    const fake = makeScanFakePrisma() as any
    const poSvc = makePoService()
    const svc = new TransferService(fake, { log: jest.fn() } as any, poSvc as any)
    const res = await svc.scan('t_demo', { warehouseId: 'w_t1', scanValue: 'YT456', scanType: 'trackingNo' })
    expect(res.advanced).toBe(false)
    expect(res.purchaseOrder.status).toBe('arrived')
    expect(res.matched).toBe(true)
    // 已关联订单则不再调用自动匹配
    expect(poSvc.autoMatch).not.toHaveBeenCalled()
  })

  it('SKU 条码扫码：经采购单明细反查父采购单', async () => {
    const fake = makeScanFakePrisma() as any
    const poSvc = makePoService()
    const svc = new TransferService(fake, { log: jest.fn() } as any, poSvc as any)
    const res = await svc.scan('t_demo', { warehouseId: 'w_t1', scanValue: 'sk9', scanType: 'barcode' })
    expect(res.asn.purchaseOrderId).toBe('po_3')
    expect(res.advanced).toBe(true)
  })

  it('中转仓不存在或无权限：抛 WAREHOUSE_NOT_FOUND', async () => {
    const fake = makeScanFakePrisma() as any
    const poSvc = makePoService()
    const svc = new TransferService(fake, { log: jest.fn() } as any, poSvc as any)
    await expect(svc.scan('t_demo', { warehouseId: 'nope', scanValue: 'SF123', scanType: 'trackingNo' })).rejects.toThrow(
      BusinessException,
    )
  })

  it('扫码值无法解析采购单：抛 SCAN_NO_PURCHASE_ORDER', async () => {
    const fake = makeScanFakePrisma() as any
    const poSvc = makePoService()
    const svc = new TransferService(fake, { log: jest.fn() } as any, poSvc as any)
    await expect(
      svc.scan('t_demo', { warehouseId: 'w_t1', scanValue: 'NOT_EXIST', scanType: 'trackingNo' }),
    ).rejects.toThrow(BusinessException)
  })
})

