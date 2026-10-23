/**
 * 供应商代发服务单测（任务 1.9，方案 §21）。
 * 用轻量 fake Prisma + fake Logger 验证供应商档案 CRUD、代发单创建与状态机流转，
 * 无需真实数据库（§31 自洽验证）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { SuppliersService } from './suppliers.service'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 内存版 fake Prisma：仅实现本服务用到的方法，断言业务语义。 */
function makeFakePrisma() {
  const suppliers: any[] = []
  const orders: any[] = []
  let seq = 0
  const id = (p: string) => `${p}_${++seq}`
  return {
    suppliers,
    orders,
    supplier: {
      findUnique: jest.fn(async ({ where }: any) => suppliers.find((s) => s.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) => suppliers.filter((s) => s.tenantId === where.tenantId)),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: id('sup'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        suppliers.push(row)
        return row
      }),
    },
    supplierOrder: {
      findMany: jest.fn(async ({ where }: any) => orders.filter((o) => o.tenantId === where.tenantId)),
      findUnique: jest.fn(async ({ where }: any) => orders.find((o) => o.id === where.id) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: id('so'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        orders.push(row)
        return row
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = orders.find((o) => o.id === where.id)!
        Object.assign(row, data)
        return row
      }),
    },
  }
}

const fakeLogger: any = { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }

describe('SuppliersService（§21 供应商代发链路）', () => {
  let prisma: ReturnType<typeof makeFakePrisma>
  let service: SuppliersService

  beforeEach(() => {
    prisma = makeFakePrisma()
    service = new SuppliersService(prisma as any, fakeLogger)
  })

  it('供应商档案：创建后可在当前租户列出', async () => {
    const a = await service.createSupplier('t1', '深圳供货商A')
    await service.createSupplier('t1', '义乌供货商B')
    expect(a.id).toBeTruthy()
    const list = await service.listSuppliers('t1')
    expect(list).toHaveLength(2)
    expect(list.map((x) => x.name)).toEqual(expect.arrayContaining(['深圳供货商A', '义乌供货商B']))
  })

  it('供应商档案：租户隔离，其它租户看不到', async () => {
    await service.createSupplier('t1', 'A')
    const other = await service.listSuppliers('t2')
    expect(other).toHaveLength(0)
  })

  it('代发单：创建后初始态 pushed 且归属正确租户', async () => {
    const sup = await service.createSupplier('t1', 'A')
    const so = await service.create('t1', { supplierId: sup.id, orderId: 'ORD-1' })
    expect(so.status).toBe('pushed')
    expect(so.supplierId).toBe(sup.id)
    expect(so.orderId).toBe('ORD-1')
  })

  it('代发单：供应商不存在时抛 SUPPLIER_NOT_FOUND', async () => {
    await expect(service.create('t1', { supplierId: 'nope' })).rejects.toMatchObject({
      message: expect.stringContaining('供应商不存在'),
    })
  })

  it('代发单：状态机允许 pushed→shipped 一步前进', async () => {
    const sup = await service.createSupplier('t1', 'A')
    const so = await service.create('t1', { supplierId: sup.id })
    const adv = await service.advance('t1', so.id, 'shipped')
    expect(adv.status).toBe('shipped')
  })

  it('代发单：非法回退/原地推进抛 SUPPLIER_ORDER_INVALID_TRANSITION', async () => {
    const sup = await service.createSupplier('t1', 'A')
    const so = await service.create('t1', { supplierId: sup.id })
    await expect(service.advance('t1', so.id, 'pushed')).rejects.toBeInstanceOf(BusinessException)
  })

  it('代发单：终态 done 不可再变更，抛 SUPPLIER_ORDER_FINAL', async () => {
    const sup = await service.createSupplier('t1', 'A')
    const so = await service.create('t1', { supplierId: sup.id })
    await service.advance('t1', so.id, 'done')
    await expect(service.advance('t1', so.id, 'shipped')).rejects.toMatchObject({
      message: expect.stringContaining('终态'),
    })
  })

  it('代发单：跨租户访问抛 NOT_FOUND', async () => {
    const sup = await service.createSupplier('t1', 'A')
    const so = await service.create('t1', { supplierId: sup.id })
    await expect(service.advance('t2', so.id, 'shipped')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    })
  })
})
