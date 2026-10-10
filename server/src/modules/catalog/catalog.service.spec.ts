/**
 * 商品/SKU 中心单测（任务 1.7，方案 §1 / §4 计费重 / §21 供应商映射）。
 * 全程不依赖真实数据库（内存桩 Prisma），覆盖 CRUD、三段映射解析、计费重派生与归属校验。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Prisma } from '@prisma/client'
import { CatalogService } from './catalog.service'
import { AppLogger } from '../../common/logger/app.logger'
import { BusinessException } from '../../common/response/business.exception'

/** 构造一个内部 SKU 行（满足 toSkuResponse 字段需求） */
function makeSkuRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sku1',
    tenantId: 't1',
    productId: 'p1',
    code: 'CODE-A',
    platformSku: 'PF-SKU',
    supplierSku: null,
    barcode: null,
    weightG: 500,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    createdAt: new Date('2026-10-10T00:00:00Z'),
    ...overrides,
  }
}

/** 构造内存桩 Prisma（按用例覆写具体方法返回值） */
function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    product: {
      create: jest.fn().mockResolvedValue({ id: 'p1', tenantId: 't1', title: 'T', spu: null, createdAt: new Date(), skus: [] }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ tenantId: 't1' }),
    },
    sku: {
      create: jest.fn().mockResolvedValue(makeSkuRow()),
      update: jest.fn().mockResolvedValue(makeSkuRow()),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue({ tenantId: 't1' }),
      findFirst: jest.fn().mockResolvedValue(makeSkuRow()),
    },
    supplierSku: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
    supplier: {
      findUnique: jest.fn().mockResolvedValue({ tenantId: 't1' }),
    },
    ...overrides,
  }
}

describe('CatalogService.computeWeights（§4 计费重）', () => {
  it('仅实重：无尺寸时体积重为 0，计费重=实重', () => {
    const r = CatalogService.computeWeights(800)
    expect(r.volumetricWeightG).toBe(0)
    expect(r.chargeableWeightG).toBe(800)
  })

  it('抛货：体积重 > 实重，计费重取体积重（30×20×10÷6000=1g 取整，此处放大验证口径）', () => {
    // 用较小抛比放大体积重：30*20*10/120 = 50g
    const r = CatalogService.computeWeights(10, 30, 20, 10, 120)
    expect(r.volumetricWeightG).toBe(50)
    expect(r.chargeableWeightG).toBe(50)
  })
})

describe('CatalogService 商品/SKU CRUD', () => {
  it('createProduct 返回包含空 SKU 列表的响应', async () => {
    const svc = new CatalogService(makePrisma() as never, new AppLogger())
    const r = await svc.createProduct('t1', { title: 'T' })
    expect(r.id).toBe('p1')
    expect(r.skus).toEqual([])
  })

  it('createSku 校验商品归属，成功后返回带计费重的响应', async () => {
    const prisma = makePrisma()
    const svc = new CatalogService(prisma as never, new AppLogger())
    const r = await svc.createSku('t1', { productId: 'p1', code: 'CODE-A', weightG: 500, lengthCm: 30, widthCm: 20, heightCm: 10 })
    expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: 'p1' }, select: { tenantId: true } })
    expect(r.chargeableWeightG).toBe(500) // 体积小，实重占优
  })

  it('createSku 编码重复 → 冲突异常（P2002）', async () => {
    const dupErr = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '5' })
    const prisma = makePrisma({ sku: { create: jest.fn().mockRejectedValue(dupErr) } })
    const svc = new CatalogService(prisma as never, new AppLogger())
    await expect(svc.createSku('t1', { productId: 'p1', code: 'X', weightG: 1 })).rejects.toMatchObject({
      bizCode: 'SKU_CODE_DUPLICATE',
    })
  })

  it('商品不属于当前租户 → 越权异常', async () => {
    const prisma = makePrisma({ product: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'other' }) } })
    const svc = new CatalogService(prisma as never, new AppLogger())
    await expect(svc.createSku('t1', { productId: 'p1', code: 'X', weightG: 1 })).rejects.toBeInstanceOf(
      BusinessException,
    )
  })

  it('listSkus 按 platformSku 过滤', async () => {
    const prisma = makePrisma({ sku: { findMany: jest.fn().mockResolvedValue([makeSkuRow()]) } })
    const svc = new CatalogService(prisma as never, new AppLogger())
    await svc.listSkus('t1', { platformSku: 'PF-SKU' })
    expect(prisma.sku.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', platformSku: 'PF-SKU' },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('CatalogService 三段映射（§1 / §21）', () => {
  it('resolveByPlatformSku：命中返回内部 SKU，未命中返回 null', async () => {
    const prisma = makePrisma({
      sku: { findFirst: jest.fn().mockResolvedValueOnce(makeSkuRow()).mockResolvedValueOnce(null) },
    })
    const svc = new CatalogService(prisma as never, new AppLogger())
    const hit = await svc.resolveByPlatformSku('t1', 'PF-SKU')
    expect(hit?.id).toBe('sku1')
    const miss = await svc.resolveByPlatformSku('t1', 'NOPE')
    expect(miss).toBeNull()
  })

  it('resolveSupplierSku：取指定供应商的供应商侧编码', async () => {
    const prisma = makePrisma({
      supplierSku: { findFirst: jest.fn().mockResolvedValue({ supplierSku: 'SUP-9' }) },
    })
    const svc = new CatalogService(prisma as never, new AppLogger())
    const r = await svc.resolveSupplierSku('t1', 'sku1', 'sup1')
    expect(r).toBe('SUP-9')
  })

  it('linkSupplierSku：新建 SupplierSku 并冗余写 Sku.supplierSku', async () => {
    const prisma = makePrisma({
      sku: {
        create: jest.fn().mockResolvedValue(makeSkuRow()),
        update: jest.fn().mockResolvedValue(makeSkuRow({ supplierSku: 'SUP-9' })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ tenantId: 't1' }),
        findFirst: jest.fn().mockResolvedValue(makeSkuRow()),
      },
    })
    const svc = new CatalogService(prisma as never, new AppLogger())
    const r = await svc.linkSupplierSku('t1', 'sku1', { supplierId: 'sup1', supplierSku: 'SUP-9' })
    expect(prisma.supplierSku.create).toHaveBeenCalled()
    expect(prisma.sku.update).toHaveBeenCalledWith({
      where: { id: 'sku1' },
      data: { supplierSku: 'SUP-9' },
    })
    expect(r.supplierSku).toBe('SUP-9')
  })

  it('linkSupplierSku：已存在则更新而非重复建（upsert 语义）', async () => {
    const prisma = makePrisma({
      supplierSku: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ss1' }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    })
    const svc = new CatalogService(prisma as never, new AppLogger())
    await svc.linkSupplierSku('t1', 'sku1', { supplierId: 'sup1', supplierSku: 'SUP-9' })
    expect(prisma.supplierSku.update).toHaveBeenCalled()
    expect(prisma.supplierSku.create).not.toHaveBeenCalled()
  })
})
