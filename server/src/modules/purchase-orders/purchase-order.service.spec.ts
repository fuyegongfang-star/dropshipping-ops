/**
 * 采购单服务单测（任务 6.2，方案 §21 衍生 / 阶段6 中转仓作业流）。
 * 用内存 fake Prisma 验证：列表租户隔离 + 过滤、新增（行项/Json）、详情归属、状态机转移。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-24
 */

import { PurchaseOrderService } from './purchase-order.service'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'
import type { CreatePurchaseOrderDto } from './dto/purchase-order.dto'

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeFakePrisma() {
  const purchaseOrder: any[] = [
    {
      id: 'po_1', tenantId: 't_demo', shopId: 's_1', orderId: null, trackingNo: 'SF123',
      carrier: '顺丰', platformOrderNo: null, purchaseUrl: null, productImages: ['u1'], remark: null,
      status: 'pending', createdAt: new Date('2026-10-24T00:00:00Z'), updatedAt: new Date('2026-10-24T00:00:00Z'),
      items: [{ id: 'pi_1', purchaseOrderId: 'po_1', skuId: null, productName: '耳机', quantity: 2, imageUrl: null, unitPrice: '10.00', createdAt: new Date() }],
    },
    {
      id: 'po_2', tenantId: 't_acme', shopId: null, orderId: null, trackingNo: 'YT999',
      carrier: '圆通', platformOrderNo: null, purchaseUrl: null, productImages: [], remark: null,
      status: 'arrived', createdAt: new Date('2026-10-24T01:00:00Z'), updatedAt: new Date('2026-10-24T01:00:00Z'),
      items: [],
    },
  ]
  let seq = 10
  const id = (p: string) => `${p}_${++seq}`

  return {
    purchaseOrder: {
      findMany: jest.fn(({ where, include }: any) =>
        purchaseOrder
          .filter((p) => !where?.tenantId || p.tenantId === where.tenantId)
          .filter((p) => !where?.status || p.status === where.status)
          .filter((p) => !where?.shopId || p.shopId === where.shopId)
          .map((p) => (include?.items ? p : p)),
      ),
      findFirst: jest.fn(({ where }: any) =>
        purchaseOrder.find((p) => p.id === where.id && (!where.tenantId || p.tenantId === where.tenantId)) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const row = {
          id: id('po'), createdAt: new Date('2026-10-24T02:00:00Z'), updatedAt: new Date('2026-10-24T02:00:00Z'),
          shopId: null, orderId: null, platformOrderNo: null, purchaseUrl: null, remark: null, status: 'pending',
          items: [], ...data,
        }
        if (data.items?.create) row.items = data.items.create.map((it: any) => ({ id: id('pi'), purchaseOrderId: row.id, ...it }))
        purchaseOrder.push(row)
        return row
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = purchaseOrder.find((p) => p.id === where.id)!
        Object.assign(row, data)
        return row
      }),
    },
  }
}

function makeDto(over: Partial<CreatePurchaseOrderDto> = {}): CreatePurchaseOrderDto {
  return {
    trackingNo: 'JD666', carrier: '京东', productImages: ['https://img/x.jpg'],
    items: [{ productName: '手机壳', quantity: 1 }], ...over,
  } as CreatePurchaseOrderDto
}

describe('PurchaseOrderService (6.2)', () => {
  let svc: PurchaseOrderService

  beforeEach(() => {
    svc = new PurchaseOrderService(makeFakePrisma() as any)
  })

  it('list 仅返回本租户 + 按 status 过滤', async () => {
    const all = await svc.list('t_demo')
    expect(all.length).toBe(1)
    expect(all[0].id).toBe('po_1')
    const arrived = await svc.list('t_acme', { status: 'arrived' })
    expect(arrived.length).toBe(1)
  })

  it('create 写入 tenantId 并落库行项', async () => {
    const created = await svc.create('t_demo', makeDto())
    expect(created.id).toBeDefined()
    expect(created.tenantId).toBe('t_demo')
    expect(created.status).toBe('pending')
    expect(created.items.length).toBe(1)
  })

  it('create 无行项 → 拒绝', async () => {
    await expect(svc.create('t_demo', makeDto({ items: [] }))).rejects.toThrow(BusinessException)
  })

  it('getById 跨租户 → 404 越权', async () => {
    await expect(svc.getById('t_demo', 'po_2')).rejects.toThrow(BusinessException)
    try {
      await svc.getById('t_demo', 'po_2')
    } catch (e) {
      expect((e as BusinessException).getStatus()).toBe(HttpStatus.NOT_FOUND)
    }
  })

  it('updateStatus 合法转移 pending→arrived', async () => {
    const r = await svc.updateStatus('t_demo', 'po_1', { status: 'arrived' })
    expect(r.status).toBe('arrived')
  })

  it('updateStatus 非法转移 → 拒绝', async () => {
    await expect(svc.updateStatus('t_demo', 'po_1', { status: 'packed' })).rejects.toThrow(BusinessException)
  })
})
