/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransferService } from './transfer.service'

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
    svc = new TransferService(makeFakePrisma() as any, { log: jest.fn() } as any)
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
