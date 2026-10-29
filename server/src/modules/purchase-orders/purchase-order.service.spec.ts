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
      carrier: '顺丰', platformOrderNo: null, recipientName: null, purchaseUrl: null, productImages: ['u1'], remark: null,
      status: 'pending', createdAt: new Date('2026-10-24T00:00:00Z'), updatedAt: new Date('2026-10-24T00:00:00Z'),
      items: [{ id: 'pi_1', purchaseOrderId: 'po_1', skuId: null, productName: '耳机', quantity: 2, imageUrl: null, unitPrice: '10.00', createdAt: new Date() }],
    },
    {
      id: 'po_2', tenantId: 't_acme', shopId: null, orderId: null, trackingNo: 'YT999',
      carrier: '圆通', platformOrderNo: null, recipientName: null, purchaseUrl: null, productImages: [], remark: null,
      status: 'arrived', createdAt: new Date('2026-10-24T01:00:00Z'), updatedAt: new Date('2026-10-24T01:00:00Z'),
      items: [],
    },
    // 6.4 匹配测试数据：平台单号 P001 + SKU sku_a 命中 o_1
    {
      id: 'po_3', tenantId: 't_demo', shopId: 's_1', orderId: null, trackingNo: 'JD777',
      carrier: '京东', platformOrderNo: 'P001', recipientName: '张三', purchaseUrl: 'https://supplier.example/x', productImages: [], remark: '易碎请轻放',
      status: 'pending', boxCount: 3, createdAt: new Date('2026-10-24T02:00:00Z'), updatedAt: new Date('2026-10-24T02:00:00Z'),
      items: [{ id: 'pi_3', purchaseOrderId: 'po_3', skuId: 'sku_a', productName: '数据线', quantity: 1, imageUrl: null, unitPrice: '5.00', createdAt: new Date() }],
    },
  ]
  const sku: any[] = [
    { id: 'sku_a', tenantId: 't_demo', code: 'SKU-A', productId: 'p_1' },
  ]
  const order: any[] = [
    {
      id: 'o_1', tenantId: 't_demo', platformOrderNo: 'P001', status: 'approved',
      recipient: { name: '张三', country: 'US', city: 'LA', address1: 'x', zip: '90001' },
      items: [{ id: 'oi_1', orderId: 'o_1', skuId: 'sku_a', quantity: 1, price: '9.99' }],
    },
    { id: 'o_2', tenantId: 't_acme', platformOrderNo: 'P999', status: 'approved', recipient: { name: '李四' }, items: [] },
  ]
  let seq = 10
  const id = (p: string) => `${p}_${++seq}`

  return {
    purchaseOrder: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn(({ where, include }: any) =>
        purchaseOrder
          .filter((p) => !where?.tenantId || p.tenantId === where.tenantId)
          .filter((p) => !where?.status || p.status === where.status)
          .filter((p) => !where?.shopId || p.shopId === where.shopId)
          .filter((p) => !where?.orderId || p.orderId === where.orderId)
          .map((p) => (include?.items ? p : p)),
      ),
      findFirst: jest.fn(({ where }: any) =>
        purchaseOrder.find((p) => p.id === where.id && (!where.tenantId || p.tenantId === where.tenantId)) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const row = {
          id: id('po'), createdAt: new Date('2026-10-24T02:00:00Z'), updatedAt: new Date('2026-10-24T02:00:00Z'),
          shopId: null, orderId: null, platformOrderNo: null, recipientName: null, purchaseUrl: null, remark: null, status: 'pending',
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
    order: {
      findMany: jest.fn(({ where, include }: any) =>
        order
          .filter((o) => !where?.tenantId || o.tenantId === where.tenantId)
          .map((o) => (include?.items ? o : o)),
      ),
      findFirst: jest.fn(({ where }: any) =>
        order.find((o) => o.id === where.id && (!where.tenantId || o.tenantId === where.tenantId)) ?? null,
      ),
    },
    orderItem: {
      findMany: jest.fn(({ where }: any) => {
        const items = (order as any[]).flatMap((o) => o.items ?? [])
        if (where?.orderId) {
          const ids = Array.isArray(where.orderId)
            ? where.orderId
            : where.orderId?.in ?? [where.orderId]
          return items.filter((it: any) => ids.includes(it.orderId))
        }
        return items
      }),
    },
    sku: {
      findMany: jest.fn(({ where }: any) => {
        const ids = Array.isArray(where?.id?.in) ? where.id.in : []
        return sku.filter((s) => ids.includes(s.id))
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
    expect(all.length).toBe(2)
    expect(all.map((p) => p.id).sort()).toEqual(['po_1', 'po_3'])
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

describe('PurchaseOrderService (6.4 匹配/关联)', () => {
  let svc: PurchaseOrderService

  beforeEach(() => {
    svc = new PurchaseOrderService(makeFakePrisma() as any)
  })

  it('findCandidates 命中平台单号 + SKU 重叠并按强度排序', async () => {
    const cands = await svc.findCandidates('t_demo', 'po_3')
    expect(cands.length).toBe(1)
    expect(cands[0].orderId).toBe('o_1')
    expect(cands[0].reasons).toContain('平台订单号一致')
    expect(cands[0].reasons.some((r: string) => r.startsWith('SKU'))).toBe(true)
  })

  it('findCandidates 无匹配字段 → 空', async () => {
    const cands = await svc.findCandidates('t_demo', 'po_1') // po_1 无单号/收件人/SKU
    expect(cands.length).toBe(0)
  })

  it('autoMatch 关联最强候选并设 orderId', async () => {
    const r = await svc.autoMatch('t_demo', 'po_3')
    expect(r.linked).toBe(true)
    expect(r.orderId).toBe('o_1')
    const po = await svc.getById('t_demo', 'po_3')
    expect(po.orderId).toBe('o_1')
  })

  it('autoMatch 已关联 → 幂等返回', async () => {
    await svc.autoMatch('t_demo', 'po_3')
    const r = await svc.autoMatch('t_demo', 'po_3')
    expect(r.linked).toBe(true)
    expect(r.reasons.length).toBe(0)
  })

  it('autoMatch 无候选 → 返回未匹配', async () => {
    const r = await svc.autoMatch('t_demo', 'po_1')
    expect(r.linked).toBe(false)
  })

  it('link 手动关联同租户订单成功', async () => {
    const r = await svc.link('t_demo', 'po_1', 'o_1')
    expect(r.orderId).toBe('o_1')
  })

  it('link 跨租户订单 → 404 越权', async () => {
    await expect(svc.link('t_demo', 'po_1', 'o_2')).rejects.toThrow(BusinessException)
    try {
      await svc.link('t_demo', 'po_1', 'o_2')
    } catch (e) {
      expect((e as BusinessException).getStatus()).toBe(HttpStatus.NOT_FOUND)
    }
  })

  it('unlink 清空 orderId', async () => {
    await svc.link('t_demo', 'po_1', 'o_1')
    const r = await svc.unlink('t_demo', 'po_1')
    expect(r.orderId).toBeNull()
  })

  it('listByOrder 按 orderId 过滤', async () => {
    await svc.link('t_demo', 'po_1', 'o_1')
    const list = await svc.listByOrder('t_demo', 'o_1')
    expect(list.length).toBe(1)
    expect(list[0].id).toBe('po_1')
  })
})

describe('PurchaseOrderService (7.2 收货标签打印)', () => {
  let svc: PurchaseOrderService

  beforeEach(() => {
    svc = new PurchaseOrderService(makeFakePrisma() as any)
  })

  it('getLabelData 返回标签所需全部字段并解析 SKU 编码', async () => {
    const data = await svc.getLabelData('t_demo', 'po_3')
    expect(data.purchaseNo).toBe('') // 种子 po_3 无业务单号
    expect(data.carrier).toBe('京东')
    expect(data.trackingNo).toBe('JD777')
    expect(data.supplier).toBe('https://supplier.example/x')
    expect(data.remark).toBe('易碎请轻放')
    expect(data.boxCount).toBe(3)
    expect(typeof data.printedAt).toBe('string')
    expect(data.items.length).toBe(1)
    // skuId=sku_a 应解析为内部 SKU 编码 SKU-A
    expect(data.items[0]).toEqual({ skuCode: 'SKU-A', productName: '数据线', quantity: 1 })
  })

  it('getLabelData 跨租户 → 404 越权', async () => {
    await expect(svc.getLabelData('t_acme', 'po_3')).rejects.toThrow(BusinessException)
  })

  it('updateBoxCount 落库箱数', async () => {
    const r = await svc.updateBoxCount('t_demo', 'po_3', 5)
    expect(r.boxCount).toBe(5)
  })

  it('updateBoxCount 跨租户 → 404 越权', async () => {
    await expect(svc.updateBoxCount('t_acme', 'po_3', 5)).rejects.toThrow(BusinessException)
  })
})
