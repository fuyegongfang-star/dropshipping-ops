/* eslint-disable @typescript-eslint/no-explicit-any */
import { TransferService } from './transfer.service'
import { BusinessException } from '../../common/response/business.exception'

/**
 * 6.7 中转仓打包任务 + 核对的 fake Prisma（内存数组，覆盖 pack 相关仓储）。
 * 重点验证：待打包队列聚合 / 核对差异算法 / 生成任务幂等 / 标记打包推进状态。
 */
function makePackFake() {
  const warehouses: any[] = [
    { id: 'w_t', tenantId: 't_demo', type: 'transfer', name: '深圳中转仓', region: 'CN', createdAt: new Date('2026-10-23T00:00:00Z') },
    { id: 'w_other', tenantId: 't_acme', type: 'transfer', name: '别家中转仓', region: 'CN', createdAt: new Date('2026-10-20T00:00:00Z') },
  ]
  const orders: any[] = [
    { id: 'o_1', tenantId: 't_demo', platformOrderNo: 'SO-1', status: 'approved', recipient: { name: '张三' } },
    // o_2 无订单记录 → 关联订单为 null（演示跨系统差异）
  ]
  const orderItems: any[] = [
    { id: 'oi1', tenantId: 't_demo', orderId: 'o_1', skuId: 'skA', quantity: 2 },
    { id: 'oi2', tenantId: 't_demo', orderId: 'o_1', skuId: 'skB', quantity: 1 },
    { id: 'oi3', tenantId: 't_demo', orderId: 'o_1', skuId: null, quantity: 5 }, // 缺 SKU → unverified
  ]
  const purchaseOrders: any[] = [
    // o_1 的两个已匹配采购单：skA 数量一致、skB 数量不符
    { id: 'po_x', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'SF1', carrier: '顺丰', status: 'matched', items: [{ id: 'px1', skuId: 'skA', productName: '耳机', quantity: 2 }] },
    { id: 'po_y', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'YT2', carrier: '圆通', status: 'matched', items: [{ id: 'py1', skuId: 'skB', productName: '手机壳', quantity: 3 }] },
    // o_2 的已匹配采购单（无订单记录）：采购有到货但订单无需求 → extra_in_po
    { id: 'po_z', tenantId: 't_demo', orderId: 'o_2', trackingNo: 'JD3', carrier: '京东', status: 'matched', items: [{ id: 'pz1', skuId: 'skC', productName: '数据线', quantity: 1 }] },
    // 非 matched（arrived）不应进入待打包队列
    { id: 'po_arr', tenantId: 't_demo', orderId: 'o_1', trackingNo: 'ARR', carrier: 'x', status: 'arrived', items: [] },
    // 别租户，须隔离
    { id: 'po_other', tenantId: 't_acme', orderId: 'o_1', trackingNo: 'ZZ', carrier: 'z', status: 'matched', items: [] },
  ]
  let packSeq = 0
  const packTasks: any[] = []

  const matchWhere = (rec: any, where: any): boolean => {
    if (!where) return true
    if (where.tenantId && rec.tenantId !== where.tenantId) return false
    if (where.type && rec.type !== where.type) return false
    if (where.status && Array.isArray(where.status) && !where.status.includes(rec.status)) return false
    if (where.status && typeof where.status === 'string' && rec.status !== where.status) return false
    if (where.orderId && where.orderId.not === null && rec.orderId === null) return false
    if (where.orderId && typeof where.orderId === 'string' && rec.orderId !== where.orderId) return false
    if (where.orderId && Array.isArray(where.orderId.in) && !where.orderId.in.includes(rec.orderId)) return false
    if (where.id && typeof where.id === 'string' && rec.id !== where.id) return false
    if (where.id && Array.isArray(where.id.in) && !where.id.in.includes(rec.id)) return false
    return true
  }

  return {
    warehouse: {
      findMany: jest.fn(({ where }: any) => warehouses.filter((w) => matchWhere(w, where))),
      findFirst: jest.fn(({ where }: any) => warehouses.find((w) => matchWhere(w, where)) || null),
    },
    order: {
      findMany: jest.fn(({ where }: any) => orders.filter((o) => matchWhere(o, where))),
      findFirst: jest.fn(({ where }: any) => orders.find((o) => matchWhere(o, where)) || null),
    },
    orderItem: {
      findMany: jest.fn(({ where }: any) => orderItems.filter((oi) => matchWhere(oi, where))),
    },
    purchaseOrder: {
      findMany: jest.fn(({ where, include }: any) =>
        purchaseOrders.filter((p) => matchWhere(p, where)).map((p) => (include?.items || include?.select ? p : p)),
      ),
      findFirst: jest.fn(({ where }: any) => purchaseOrders.find((p) => matchWhere(p, where)) || null),
      updateMany: jest.fn(({ where, data }: any) => {
        let n = 0
        for (const p of purchaseOrders) {
          if (matchWhere(p, where)) {
            Object.assign(p, data)
            n++
          }
        }
        return { count: n }
      }),
    },
    packTask: {
      findMany: jest.fn(({ where }: any) => packTasks.filter((t) => matchWhere(t, where))),
      findFirst: jest.fn(({ where }: any) => packTasks.find((t) => matchWhere(t, where)) || null),
      create: jest.fn(({ data }: any) => {
        const row = { id: `pt_demo_${++packSeq}`, createdAt: new Date(), ...data }
        packTasks.push(row)
        return row
      }),
      update: jest.fn(({ where, data }: any) => {
        const idx = packTasks.findIndex((t) => t.id === where.id)
        if (idx >= 0) {
          packTasks[idx] = { ...packTasks[idx], ...data }
          if (data.status) packTasks[idx].status = data.status
          if (data.packedAt) packTasks[idx].packedAt = data.packedAt
          return packTasks[idx]
        }
        return null
      }),
    },
    __packTasks: packTasks,
    __getPos: () => purchaseOrders,
  }
}

describe('TransferService (6.7 中转仓打包任务 + 核对)', () => {
  function svc(fake: any) {
    return new TransferService(fake as any, { log: jest.fn() } as any, {} as any)
  }

  it('待打包队列：按关联订单聚合 matched 采购单，并预计算核对差异', async () => {
    const fake = makePackFake()
    const q = await svc(fake).getPackQueue('t_demo')
    // o_1（2 个 matched PO）+ o_2（1 个 matched PO）；po_arr(arrived) 与别租户被排除
    expect(q.items.map((i) => i.orderId).sort()).toEqual(['o_1', 'o_2'])
    expect(q.stats.matchedPoCount).toBe(3)
    const o1 = q.items.find((i) => i.orderId === 'o_1')!
    // o_1：skA 一致 / skB 数量不符 / 缺 SKU 行 → matched=1 qtyMismatch=1 unverified=1
    expect(o1.summary).toEqual({ total: 3, matched: 1, qtyMismatch: 1, missing: 0, extra: 0, unverified: 1, hasDifference: true })
  })

  it('待打包队列：已生成任务则标注 task 关联', async () => {
    const fake = makePackFake()
    await svc(fake).generatePackTasks('t_demo')
    const q = await svc(fake).getPackQueue('t_demo')
    expect(q.items.every((i) => i.task && i.task.status === 'pending')).toBe(true)
  })

  it('生成打包任务：按订单聚合创建，幂等（二次调用不重复）', async () => {
    const fake = makePackFake()
    const r1 = await svc(fake).generatePackTasks('t_demo')
    expect(r1.created).toBe(2) // o_1, o_2
    expect(r1.tasks.length).toBe(2)
    const r2 = await svc(fake).generatePackTasks('t_demo')
    expect(r2.created).toBe(0) // 已存在，跳过
    expect(r2.tasks.length).toBe(2)
  })

  it('核对差异：missing_in_po 与 extra_in_po 正确识别', async () => {
    const fake = makePackFake()
    const { tasks } = await svc(fake).generatePackTasks('t_demo')
    const o2 = tasks.find((t) => t.orderId === 'o_2')! // 无订单记录
    const check = await svc(fake).getPackCheck('t_demo', o2.id)
    // o_2 采购有 skC 到货，但订单行项为空 → 全部 extra_in_po
    expect(check.summary.extra).toBe(1)
    expect(check.summary.hasDifference).toBe(true)
  })

  it('标记打包：推进聚合采购单 matched→packed，并置任务为 packed（幂等）', async () => {
    const fake = makePackFake()
    const { tasks } = await svc(fake).generatePackTasks('t_demo')
    const o1 = tasks.find((t) => t.orderId === 'o_1')!
    const packed = await svc(fake).pack('t_demo', o1.id)
    expect(packed.status).toBe('packed')
    expect(packed.packedAt).not.toBeNull()
    // 聚合采购单 po_x / po_y 由 matched 推进到 packed
    const pos = fake.__getPos() as any[]
    expect(pos.find((p: any) => p.id === 'po_x').status).toBe('packed')
    expect(pos.find((p: any) => p.id === 'po_y').status).toBe('packed')
    // 幂等：再次打包不改变状态，不报错
    const again = await svc(fake).pack('t_demo', o1.id)
    expect(again.status).toBe('packed')
  })

  it('标记打包：任务不存在抛 PACK_TASK_NOT_FOUND', async () => {
    const fake = makePackFake()
    await expect(svc(fake).pack('t_demo', 'nope')).rejects.toThrow(BusinessException)
  })

  it('租户隔离：t_acme 队列不泄漏 t_demo 的采购单', async () => {
    const fake = makePackFake()
    const q = await svc(fake).getPackQueue('t_acme')
    const leaked = q.items.flatMap((i) => i.purchaseOrderIds)
    expect(leaked).not.toContain('po_x')
    expect(leaked).not.toContain('po_y')
    expect(leaked).not.toContain('po_z')
    // t_acme 自有采购单 po_other 可进入其队列（隔离不阻断本租户数据）
    expect(leaked).toContain('po_other')
  })
})
