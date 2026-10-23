/**
 * WMS 服务单测（任务 2.2/2.3，方案 §15）。
 * 用内存 fake Prisma 验证仓库(国内/海外)、入库(ASN→收货→上架)、库存调整、拣货波次，
 * 无需真实数据库。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { WmsService } from './wms.service'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeFakePrisma() {
  const warehouse: any[] = []
  const asn: any[] = []
  const bin: any[] = []
  const inventory: any[] = []
  const pickTask: any[] = []
  let seq = 0
  const id = (p: string) => `${p}_${++seq}`

  return {
    warehouse: {
      findMany: jest.fn(({ where }: any) => warehouse.filter((w) => w.tenantId === where.tenantId)),
      findUnique: jest.fn(({ where }: any) => warehouse.find((w) => w.id === where.id) ?? null),
      create: jest.fn(({ data }: any) => {
        const row = { id: id('wh'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        warehouse.push(row)
        return row
      }),
    },
    asn: {
      findMany: jest.fn(({ where }: any) =>
        asn.filter((a) => a.tenantId === where.tenantId && (!where.warehouseId || a.warehouseId === where.warehouseId)),
      ),
      findUnique: jest.fn(({ where }: any) => asn.find((a) => a.id === where.id) ?? null),
      create: jest.fn(({ data }: any) => {
        const row = { id: id('asn'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        asn.push(row)
        return row
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = asn.find((a) => a.id === where.id)!
        Object.assign(row, data)
        return row
      }),
    },
    bin: {
      findFirst: jest.fn(({ where }: any) =>
        bin.find((b) => b.tenantId === where.tenantId && b.warehouseId === where.warehouseId && b.code === where.code) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const row = { id: id('bin'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        bin.push(row)
        return row
      }),
    },
    inventory: {
      findUnique: jest.fn(({ where }: any) => {
        const k = where.tenantId_warehouseId_skuId_binId
        return (
          inventory.find(
            (i) =>
              i.tenantId === k.tenantId &&
              i.warehouseId === k.warehouseId &&
              i.skuId === k.skuId &&
              (i.binId ?? null) === (k.binId ?? null),
          ) ?? null
        )
      }),
      findFirst: jest.fn(({ where }: any) =>
        inventory.find(
          (i) =>
            i.tenantId === where.tenantId &&
            i.warehouseId === where.warehouseId &&
            i.skuId === where.skuId &&
            (i.binId ?? null) === (where.binId ?? null),
        ) ?? null,
      ),
      create: jest.fn(({ data }: any) => {
        const row = { id: id('inv'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        inventory.push(row)
        return row
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = inventory.find((i) => i.id === where.id)!
        if (data.qty && data.qty.increment != null) row.qty += data.qty.increment
        if (typeof data.qty === 'number') row.qty = data.qty
        return row
      }),
      upsert: jest.fn(({ where, create, update }: any) => {
        const k = where.tenantId_warehouseId_skuId_binId
        const existing = inventory.find(
          (i) =>
            i.tenantId === k.tenantId &&
            i.warehouseId === k.warehouseId &&
            i.skuId === k.skuId &&
            (i.binId ?? null) === (k.binId ?? null),
        )
        if (existing) {
          if (update.qty && update.qty.increment != null) existing.qty += update.qty.increment
          if (typeof update.qty === 'number') existing.qty = update.qty
          return existing
        }
        const row = { id: id('inv'), createdAt: new Date('2026-10-23T00:00:00Z'), lockedQty: 0, ...create }
        inventory.push(row)
        return row
      }),
    },
    pickTask: {
      findMany: jest.fn(({ where }: any) =>
        pickTask.filter((p) => p.tenantId === where.tenantId && (!where.warehouseId || p.warehouseId === where.warehouseId)),
      ),
      findUnique: jest.fn(({ where }: any) => pickTask.find((p) => p.id === where.id) ?? null),
      create: jest.fn(({ data }: any) => {
        const row = { id: id('pick'), createdAt: new Date('2026-10-23T00:00:00Z'), ...data }
        pickTask.push(row)
        return row
      }),
      update: jest.fn(({ where, data }: any) => {
        const row = pickTask.find((p) => p.id === where.id)!
        Object.assign(row, data)
        return row
      }),
    },
  }
}

const fakeLogger: any = { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }

describe('WmsService（§15 海外仓与一件代发）', () => {
  let prisma: ReturnType<typeof makeFakePrisma>
  let svc: WmsService

  beforeEach(() => {
    prisma = makeFakePrisma()
    svc = new WmsService(prisma as any, fakeLogger)
  })

  it('仓库：国内仓可创建；海外仓缺区域抛错', async () => {
    const domestic = await svc.createWarehouse('t1', { name: '深圳仓', type: 'domestic' })
    expect(domestic.type).toBe('domestic')
    await expect(svc.createWarehouse('t1', { name: 'US 仓', type: 'overseas' })).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
    })
    const overseas = await svc.createWarehouse('t1', { name: 'US-West 仓', type: 'overseas', region: 'US' })
    expect(overseas.region).toBe('US')
    expect((await svc.listWarehouses('t1')).length).toBe(2)
  })

  it('入库：ASN 创建→收货→上架 触发库存增加；同仓同 SKU 同库位跨 ASN 累加', async () => {
    const wh = await svc.createWarehouse('t1', { name: '深圳仓', type: 'domestic' })
    const asn = await svc.createAsn('t1', { warehouseId: wh.id })
    expect(asn.status).toBe('pending')
    await svc.receiveAsn('t1', asn.id)
    const inv = await svc.putaway('t1', asn.id, { skuId: 'sku_1', qty: 10, binCode: 'A-01' })
    expect(inv.qty).toBe(10)
    // 再次上架同 SKU 同库位（新建 ASN 收货后上架）累加至 15（库存按 仓+SKU+库位 维度）
    const asn2 = await svc.createAsn('t1', { warehouseId: wh.id })
    await svc.receiveAsn('t1', asn2.id)
    const inv2 = await svc.putaway('t1', asn2.id, { skuId: 'sku_1', qty: 5, binCode: 'A-01' })
    expect(inv2.qty).toBe(15)
  })

  it('入库：ASN 关闭后不可重复上架', async () => {
    const wh = await svc.createWarehouse('t1', { name: '深圳仓', type: 'domestic' })
    const asn = await svc.createAsn('t1', { warehouseId: wh.id })
    await svc.receiveAsn('t1', asn.id)
    await svc.putaway('t1', asn.id, { skuId: 'sku_1', qty: 10, binCode: 'A-01' })
    await expect(svc.putaway('t1', asn.id, { skuId: 'sku_1', qty: 1, binCode: 'A-01' })).rejects.toBeInstanceOf(
      BusinessException,
    )
  })

  it('库存：出库不得使库存为负，抛 INVENTORY_INSUFFICIENT', async () => {
    const wh = await svc.createWarehouse('t1', { name: '深圳仓', type: 'domestic' })
    await svc.adjustInventory('t1', { warehouseId: wh.id, skuId: 'sku_a', delta: 5 })
    await expect(
      svc.adjustInventory('t1', { warehouseId: wh.id, skuId: 'sku_a', delta: -10 }),
    ).rejects.toMatchObject({ message: expect.stringContaining('库存不足') })
  })

  it('拣货：波次生成任务且可完成', async () => {
    const wh = await svc.createWarehouse('t1', { name: '深圳仓', type: 'domestic' })
    const tasks = await svc.createWave('t1', { warehouseId: wh.id, orderIds: ['o1', 'o2'] })
    expect(tasks).toHaveLength(2)
    const done = await svc.completePick('t1', tasks[0].id)
    expect(done.status).toBe('done')
  })

  it('隔离：跨租户访问仓库抛 NOT_FOUND', async () => {
    const wh = await svc.createWarehouse('t1', { name: '深圳仓', type: 'domestic' })
    await expect(svc.createAsn('t2', { warehouseId: wh.id })).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    })
  })
})
