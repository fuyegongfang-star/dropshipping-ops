/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 物流产品目录 / 费率卡服务测（任务 4.6，方案 §4 / §23）。
 * 用进程内内存桩模拟 Prisma logisticsProduct 模型，覆盖 CRUD、租户隔离、费率卡成本试算。
 */

import { NotFoundException } from '@nestjs/common'
import { LogisticsProductService } from './logistics-product.service'
import { CreateLogisticsProductDto, UpdateLogisticsProductDto } from './logistics-product.types'

type AnyRow = Record<string, any>

const NOW = new Date('2026-10-16T00:00:00.000Z')

/** 内存桩：仅实现 logisticsProduct 模型的必要方法（findMany/create/update/delete/findUnique）。 */
function makePrismaStub() {
  const products = { all: [] as AnyRow[] }
  let seq = 1000
  let createdCount = 0
  return {
    logisticsProduct: {
      findMany: ({ where, orderBy }: any) => {
        let res = products.all.filter((r) => (where?.tenantId ? r.tenantId === where.tenantId : true))
        if (orderBy?.createdAt === 'desc') res = [...res].sort((a, b) => b.createdAt - a.createdAt)
        return res.map((r) => ({ ...r }))
      },
      findUnique: ({ where }: any) => {
        const row = products.all.find((p) => p.id === where.id) || null
        return row ? { ...row } : null
      },
      create: ({ data }: any) => {
        // 每条记录分配严格递增的时间戳，模拟真实 DB 的 createdAt 唯一性，
        // 使 orderBy createdAt desc 能正确将后创建的排在前。
        const createdAt = new Date(NOW.getTime() + createdCount++ * 1000)
        const row = { id: `lp_${++seq}`, createdAt, updatedAt: new Date(createdAt), ...data }
        products.all.push(row)
        return { ...row }
      },
      update: ({ where, data }: any) => {
        const row = products.all.find((p) => p.id === where.id) as AnyRow
        // 模拟 Prisma：undefined 字段不写入（保留原值）
        for (const k of Object.keys(data)) {
          if (data[k] !== undefined) row[k] = data[k]
        }
        row.updatedAt = NOW
        return { ...row }
      },
      delete: ({ where }: any) => {
        const idx = products.all.findIndex((p) => p.id === where.id)
        const row = products.all[idx]
        products.all.splice(idx, 1)
        return { ...row }
      },
    },
  }
}

const noopLogger: any = { log: () => {}, error: () => {}, warn: () => {}, debug: () => {} }

function svc(): LogisticsProductService {
  return new LogisticsProductService(makePrismaStub() as any, noopLogger)
}

describe('LogisticsProductService', () => {
  it('创建物流产品：补全默认值并绑定 tenantId', async () => {
    const s = svc()
    const out = await s.create('t1', {
      carrierCode: 'yunexpress',
      name: '云途-标准专线',
    } as CreateLogisticsProductDto)
    expect(out.tenantId).toBe('t1')
    expect(out.carrierCode).toBe('yunexpress')
    expect(out.legType).toBe('direct')
    expect(out.enabled).toBe(true)
    expect(out.volumetricDivisor).toBe(5000)
    expect(out.firstWeightPrice).toBe(0)
  })

  it('列出产品：按 tenantId 隔离并按创建倒序', async () => {
    const s = svc()
    await s.create('t1', { carrierCode: 'yunexpress', name: 'P1' } as CreateLogisticsProductDto)
    await s.create('t1', { carrierCode: 'dhl', name: 'P2' } as CreateLogisticsProductDto)
    await s.create('t2', { carrierCode: '4px', name: 'Other' } as CreateLogisticsProductDto)
    const t1 = await s.list('t1')
    expect(t1.length).toBe(2)
    expect(t1[0].name).toBe('P2') // 后创建的排在前（desc）
    const t2 = await s.list('t2')
    expect(t2.length).toBe(1)
    expect(t2[0].name).toBe('Other')
  })

  it('更新产品：仅匹配本租户的记录', async () => {
    const s = svc()
    const created = await s.create('t1', {
      carrierCode: 'yunexpress',
      name: '云途-标准专线',
      firstWeightPrice: 18,
      additionalWeightPrice: 68,
    } as CreateLogisticsProductDto)
    const out = await s.update('t1', created.id, {
      name: '云途-经济专线',
      firstWeightPrice: 12,
    } as UpdateLogisticsProductDto)
    expect(out.name).toBe('云途-经济专线')
    expect(out.firstWeightPrice).toBe(12)
    expect(out.additionalWeightPrice).toBe(68) // 未改字段保留
  })

  it('更新他人产品：抛 NotFoundException（防越权）', async () => {
    const s = svc()
    const created = await s.create('t1', { carrierCode: 'yunexpress', name: 'P' } as CreateLogisticsProductDto)
    await expect(
      s.update('t2', created.id, { name: 'hacked' } as UpdateLogisticsProductDto),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('删除产品：需匹配本租户', async () => {
    const s = svc()
    const created = await s.create('t1', { carrierCode: 'yunexpress', name: 'P' } as CreateLogisticsProductDto)
    const res = await s.remove('t1', created.id)
    expect(res.deleted).toBe(true)
    expect((await s.list('t1')).length).toBe(0)
  })

  it('费率卡成本试算：首重价 + 续重价 × (计费重−1)', async () => {
    const s = svc()
    const created = await s.create('t1', {
      carrierCode: 'yunexpress',
      name: '云途-标准专线',
      firstWeightPrice: 18,
      additionalWeightPrice: 68,
    } as CreateLogisticsProductDto)
    // 2.5kg → 18 + 68 × 1.5 = 120
    const q = await s.computeCarrierCost(created.id, 2.5)
    expect(q.carrierCost).toBe(120)
    expect(q.transitDays).toBe('3-7天')
  })

  it('费率卡试算缺失产品：抛 NotFoundException', async () => {
    const s = svc()
    await expect(s.computeCarrierCost('nope', 1)).rejects.toBeInstanceOf(NotFoundException)
  })
})
