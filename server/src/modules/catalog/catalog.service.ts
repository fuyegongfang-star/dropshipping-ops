/**
 * 商品/SKU 中心服务（任务 1.7，方案 §1 商品映射 / §4 计费重 / §21 供应商映射）。
 * 职责：
 *   1. 商品（SPU）与内部 SKU 的 CRUD（租户行级隔离）。
 *   2. 三段映射：平台 SKU → 内部 SKU（resolveByPlatformSku）、内部 SKU → 供应商 SKU（resolveSupplierSku）。
 *   3. 计费重派生：实重与体积重取大值，供运费试算（§4）与履约路由（§5）复用。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { HttpStatus, Injectable } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import { checkBarcodeDigit } from '../../common/barcode/barcode.util'
import { DEFAULT_VOLUMETRIC_DIVISOR } from './catalog.constants'
import { CreateProductDto, ProductResponseDto } from './dto/product.dto'
import {
  AddSkuBarcodeDto,
  BarcodeLookupDto,
  CreateSkuDto,
  SkuBarcodeDto,
  SkuResponseDto,
  UpdateSkuDto,
} from './dto/sku.dto'
import { LinkSupplierSkuDto } from './dto/supplier-sku.dto'

/** SKU 列表过滤条件 */
export interface SkuFilter {
  platformSku?: string
  supplierSku?: string
}

/** Prisma Sku 行（用于 toSkuResponse 入参，避免重复引入生成类型） */
type SkuRow = {
  id: string
  tenantId: string
  productId: string
  code: string
  platformSku: string | null
  supplierSku: string | null
  barcode: string | null
  weightG: number
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  createdAt: Date
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  // ===================== 商品（SPU） =====================

  /** 创建商品（SPU），SKU 走独立接口维护 */
  async createProduct(tenantId: string, dto: CreateProductDto): Promise<ProductResponseDto> {
    const created = await this.prisma.product.create({
      data: { tenantId, title: dto.title, spu: dto.spu ?? null },
    })
    return this.toProductResponse(created)
  }

  /** 列出租户下全部商品（含各自 SKU；Product↔Sku 为标量外键，分别查后聚合） */
  async listProducts(tenantId: string): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    const productIds = products.map((p) => p.id)
    const skuRows: SkuRow[] = productIds.length
      ? await this.prisma.sku.findMany({ where: { productId: { in: productIds } } })
      : []
    const skusByProduct = new Map<string, SkuRow[]>()
    for (const s of skuRows) {
      const list = skusByProduct.get(s.productId) ?? []
      list.push(s)
      skusByProduct.set(s.productId, list)
    }
    return products.map((p) =>
      this.toProductResponse(
        p,
        (skusByProduct.get(p.id) ?? []).map((s) => this.toSkuResponse(s)),
      ),
    )
  }

  // ===================== 内部 SKU =====================

  /** 创建内部 SKU（校验所属商品归属当前租户；code 租户内唯一） */
  async createSku(tenantId: string, dto: CreateSkuDto): Promise<SkuResponseDto> {
    await this.assertProductOwned(tenantId, dto.productId)
    try {
      const created = await this.prisma.sku.create({
        data: {
          tenantId,
          productId: dto.productId,
          code: dto.code,
          platformSku: dto.platformSku ?? null,
          supplierSku: dto.supplierSku ?? null,
          barcode: this.normalizeBarcode(dto.barcode),
          weightG: dto.weightG,
          lengthCm: dto.lengthCm ?? null,
          widthCm: dto.widthCm ?? null,
          heightCm: dto.heightCm ?? null,
        },
      })
      return this.toSkuResponse(created)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BusinessException('SKU_CODE_DUPLICATE', '内部 SKU 编码重复', HttpStatus.CONFLICT)
      }
      throw err
    }
  }

  /** 部分更新内部 SKU（仅传非空字段） */
  async updateSku(tenantId: string, skuId: string, dto: UpdateSkuDto): Promise<SkuResponseDto> {
    await this.assertSkuOwned(tenantId, skuId)
    if (dto.productId) await this.assertProductOwned(tenantId, dto.productId)

    const data: Prisma.SkuUpdateInput = {}
    if (dto.productId !== undefined) data.productId = dto.productId
    if (dto.code !== undefined) data.code = dto.code
    if (dto.platformSku !== undefined) data.platformSku = dto.platformSku
    if (dto.supplierSku !== undefined) data.supplierSku = dto.supplierSku
    if (dto.barcode !== undefined) data.barcode = this.normalizeBarcode(dto.barcode)
    if (dto.weightG !== undefined) data.weightG = dto.weightG
    if (dto.lengthCm !== undefined) data.lengthCm = dto.lengthCm
    if (dto.widthCm !== undefined) data.widthCm = dto.widthCm
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm

    try {
      const updated = await this.prisma.sku.update({ where: { id: skuId }, data })
      return this.toSkuResponse(updated)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BusinessException('SKU_CODE_DUPLICATE', '内部 SKU 编码重复', HttpStatus.CONFLICT)
      }
      throw err
    }
  }

  /** 列出租户下 SKU（支持按 platformSku / supplierSku 过滤） */
  async listSkus(tenantId: string, filter: SkuFilter = {}): Promise<SkuResponseDto[]> {
    const where: Prisma.SkuWhereInput = { tenantId }
    if (filter.platformSku) where.platformSku = filter.platformSku
    if (filter.supplierSku) where.supplierSku = filter.supplierSku
    const rows = await this.prisma.sku.findMany({ where, orderBy: { createdAt: 'desc' } })
    return rows.map((r) => this.toSkuResponse(r))
  }

  // ===================== 条码 / 多码管理（任务 7.1）=====================

  /**
   * 条码反查 SKU：先查主码 Sku.barcode，再查多码表 SkuBarcode（同租户隔离）。
   * 用于「扫条码定位 SKU」与后续 PDA 扫码建档。未命中返回 null。
   */
  async lookupByBarcode(
    tenantId: string,
    code: string,
  ): Promise<BarcodeLookupDto | null> {
    const normalized = (code ?? '').trim()
    if (!normalized) return null
    const sku = await this.prisma.sku.findFirst({
      where: { tenantId, barcode: normalized },
      select: { id: true, productId: true },
    })
    if (sku) {
      const productName = await this.productTitle(tenantId, sku.productId)
      return {
        skuId: sku.id,
        code: normalized,
        productName,
        matchedBy: 'main',
        kind: null,
      }
    }
    const alt = await this.prisma.skuBarcode.findFirst({
      where: { tenantId, code: normalized },
      select: { skuId: true, kind: true },
    })
    if (alt) {
      const productName = await this.skuProductTitle(tenantId, alt.skuId)
      return {
        skuId: alt.skuId,
        code: normalized,
        productName,
        matchedBy: 'alt',
        kind: alt.kind,
      }
    }
    return null
  }

  /** 取商品标题（按商品 id，跨租户隔离由调用方保证） */
  private async productTitle(tenantId: string, productId?: string | null): Promise<string> {
    if (!productId) return ''
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { tenantId: true, title: true },
    })
    return p && p.tenantId === tenantId ? p.title : ''
  }

  /** 取 SKU 所属商品标题 */
  private async skuProductTitle(tenantId: string, skuId: string): Promise<string> {
    const sku = await this.prisma.sku.findUnique({
      where: { id: skuId },
      select: { tenantId: true, productId: true },
    })
    if (!sku || sku.tenantId !== tenantId) return ''
    return this.productTitle(tenantId, sku.productId)
  }

  /** 列出某 SKU 的全部多码（不含主码） */
  async listBarcodes(tenantId: string, skuId: string): Promise<SkuBarcodeDto[]> {
    await this.assertSkuOwned(tenantId, skuId)
    const rows = await this.prisma.skuBarcode.findMany({
      where: { tenantId, skuId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      skuId: r.skuId,
      code: r.code,
      kind: r.kind,
      createdAt: r.createdAt,
    }))
  }

  /**
   * 新增多码：与 Sku.barcode 以及 SkuBarcode 同租户内互斥去重，重复抛 SKU_BARCODE_DUPLICATE。
   */
  async addBarcode(
    tenantId: string,
    skuId: string,
    dto: AddSkuBarcodeDto,
  ): Promise<SkuBarcodeDto> {
    await this.assertSkuOwned(tenantId, skuId)
    const code = (dto.code ?? '').trim()
    if (!code) {
      throw new BusinessException('SKU_BARCODE_EMPTY', '条码不能为空', HttpStatus.BAD_REQUEST)
    }
    // 互斥去重：主码 + 多码任一存在即冲突
    const mainHit = await this.prisma.sku.findFirst({
      where: { tenantId, barcode: code },
      select: { id: true, code: true },
    })
    if (mainHit) {
      throw new BusinessException(
        'SKU_BARCODE_DUPLICATE',
        `条码 ${code} 已作为主码存在于 SKU ${mainHit.code}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const altHit = await this.prisma.skuBarcode.findFirst({
      where: { tenantId, code },
      select: { id: true, skuId: true },
    })
    if (altHit) {
      const sku = await this.prisma.sku.findUnique({
        where: { id: altHit.skuId },
        select: { code: true },
      })
      throw new BusinessException(
        'SKU_BARCODE_DUPLICATE',
        `条码 ${code} 已作为多码存在于 SKU ${sku?.code ?? altHit.skuId}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const created = await this.prisma.skuBarcode.create({
      data: {
        tenantId,
        skuId,
        code,
        kind: dto.kind && dto.kind.length ? dto.kind : 'other',
      },
    })
    return {
      id: created.id,
      tenantId: created.tenantId,
      skuId: created.skuId,
      code: created.code,
      kind: created.kind,
      createdAt: created.createdAt,
    }
  }

  /** 删除多码（按 id，租户隔离） */
  async deleteBarcode(tenantId: string, barcodeId: string): Promise<void> {
    const found = await this.prisma.skuBarcode.findUnique({
      where: { id: barcodeId },
      select: { tenantId: true },
    })
    if (!found || found.tenantId !== tenantId) {
      throw new BusinessException('SKU_BARCODE_NOT_FOUND', '多码不存在或越权', HttpStatus.NOT_FOUND)
    }
    await this.prisma.skuBarcode.delete({ where: { id: barcodeId } })
  }

  /**
   * 设为主码：将某多码提升为 Sku.barcode，原主码降级为多码（保持总码数不丢）。
   * 幂等：主码已是目标则直接返回。
   */
  async setMainBarcode(tenantId: string, skuId: string, barcodeId: string): Promise<SkuResponseDto> {
    await this.assertSkuOwned(tenantId, skuId)
    const target = await this.prisma.skuBarcode.findUnique({
      where: { id: barcodeId },
      select: { tenantId: true, skuId: true, code: true },
    })
    if (!target || target.tenantId !== tenantId || target.skuId !== skuId) {
      throw new BusinessException('SKU_BARCODE_NOT_FOUND', '多码不存在或越权', HttpStatus.NOT_FOUND)
    }
    const sku = await this.prisma.sku.findUnique({ where: { id: skuId }, select: { barcode: true } })
    if (sku?.barcode === target.code) return this.toSkuResponse(await this.prisma.sku.findUniqueOrThrow({ where: { id: skuId } }) as SkuRow)

    // 事务：原主码降级为多码（若非 null 且未被其它多码占用），新码写入 Sku.barcode
    await this.prisma.$transaction(async (tx) => {
      if (sku?.barcode) {
        const occupied = await tx.skuBarcode.findFirst({
          where: { tenantId, code: sku.barcode },
          select: { id: true },
        })
        if (!occupied) {
          await tx.skuBarcode.create({ data: { tenantId, skuId, code: sku.barcode, kind: 'internal' } })
        }
      }
      await tx.sku.update({ where: { id: skuId }, data: { barcode: target.code } })
      await tx.skuBarcode.delete({ where: { id: barcodeId } })
    })
    const updated = await this.prisma.sku.findUniqueOrThrow({ where: { id: skuId } })
    return this.toSkuResponse(updated as SkuRow)
  }

  // ===================== 三段映射 =====================

  /**
   * 平台 SKU → 内部 SKU（§1 平台↔内部映射）。
   * 拉单落库时据此回填 OrderItem.skuId，使审单/库存校验能关联到统一内部编码。
   */
  async resolveByPlatformSku(tenantId: string, platformSku: string): Promise<SkuResponseDto | null> {
    if (!platformSku) return null
    const row = await this.prisma.sku.findFirst({
      where: { tenantId, platformSku },
      orderBy: { createdAt: 'asc' },
    })
    return row ? this.toSkuResponse(row) : null
  }

  /** 内部 SKU → 供应商 SKU（§21 内部↔供应商映射）；同一 SKU 多供应商时取指定供应商 */
  async resolveSupplierSku(
    tenantId: string,
    skuId: string,
    supplierId: string,
  ): Promise<string | null> {
    const row = await this.prisma.supplierSku.findFirst({
      where: { tenantId, skuId, supplierId },
      orderBy: { createdAt: 'asc' },
    })
    return row ? row.supplierSku : null
  }

  /** 设定内部 SKU 的平台映射键（§1 平台↔内部）：用于把某平台 SKU 绑定到内部 SKU */
  async syncPlatformSku(
    tenantId: string,
    skuId: string,
    platformSku: string,
  ): Promise<SkuResponseDto> {
    await this.assertSkuOwned(tenantId, skuId)
    const updated = await this.prisma.sku.update({
      where: { id: skuId },
      data: { platformSku },
    })
    return this.toSkuResponse(updated)
  }

  /**
   * 关联供应商 SKU（§21）：upsert SupplierSku 记录，并同步冗余字段 Sku.supplierSku。
   * 一个内部 SKU 可对应多个供应商；Sku.supplierSku 冗余保存「最近一次关联」便于快速取用。
   */
  async linkSupplierSku(
    tenantId: string,
    skuId: string,
    dto: LinkSupplierSkuDto,
  ): Promise<SkuResponseDto> {
    await this.assertSkuOwned(tenantId, skuId)
    await this.assertSupplierOwned(tenantId, dto.supplierId)

    const existing = await this.prisma.supplierSku.findFirst({
      where: { tenantId, skuId, supplierId: dto.supplierId },
    })
    if (existing) {
      await this.prisma.supplierSku.update({
        where: { id: existing.id },
        data: { supplierSku: dto.supplierSku },
      })
    } else {
      await this.prisma.supplierSku.create({
        data: {
          tenantId,
          supplierId: dto.supplierId,
          skuId,
          supplierSku: dto.supplierSku,
        },
      })
    }
    // 冗余字段便于快速取用（权威来源仍为 SupplierSku 表）
    const updated = await this.prisma.sku.update({
      where: { id: skuId },
      data: { supplierSku: dto.supplierSku },
    })
    return this.toSkuResponse(updated)
  }

  // ===================== 私有工具 =====================

  /** 条码归一：去首尾空白，空串归为 null（便于"清空主码"） */
  private normalizeBarcode(v?: string | null): string | null {
    const t = (v ?? '').trim()
    return t.length ? t : null
  }

  /** 校验商品归属当前租户（越权访问抛异常） */
  private async assertProductOwned(tenantId: string, productId: string): Promise<void> {
    const found = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { tenantId: true },
    })
    if (!found || found.tenantId !== tenantId) {
      throw new BusinessException('PRODUCT_NOT_FOUND', '商品不存在或越权', HttpStatus.NOT_FOUND)
    }
  }

  /** 校验内部 SKU 归属当前租户 */
  private async assertSkuOwned(tenantId: string, skuId: string): Promise<void> {
    const found = await this.prisma.sku.findUnique({
      where: { id: skuId },
      select: { tenantId: true },
    })
    if (!found || found.tenantId !== tenantId) {
      throw new BusinessException('SKU_NOT_FOUND', '内部 SKU 不存在或越权', HttpStatus.NOT_FOUND)
    }
  }

  /** 校验供应商归属当前租户（§21） */
  private async assertSupplierOwned(tenantId: string, supplierId: string): Promise<void> {
    const found = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { tenantId: true },
    })
    if (!found || found.tenantId !== tenantId) {
      throw new BusinessException('SUPPLIER_NOT_FOUND', '供应商不存在或越权', HttpStatus.NOT_FOUND)
    }
  }

  /** Prisma Product 行 → 响应 DTO（skus 已在外层聚合，直接透传） */
  private toProductResponse(
    row: { id: string; tenantId: string; title: string; spu: string | null; createdAt: Date },
    skus: SkuResponseDto[] = [],
  ): ProductResponseDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      title: row.title,
      spu: row.spu,
      createdAt: row.createdAt,
      skus,
    }
  }

  /** Prisma Sku 行 → 响应 DTO（含计费重派生） */
  private toSkuResponse(row: SkuRow): SkuResponseDto {
    const { volumetricWeightG, chargeableWeightG } = CatalogService.computeWeights(
      row.weightG,
      row.lengthCm,
      row.widthCm,
      row.heightCm,
    )
    // 条码校验位提示：命中 EAN-13/UPC-A 但校验位不符时给出建议（不拦截录入）。
    const barcodeCheckWarning = this.buildBarcodeWarning(row.barcode)
    return {
      id: row.id,
      tenantId: row.tenantId,
      productId: row.productId,
      code: row.code,
      platformSku: row.platformSku,
      supplierSku: row.supplierSku,
      barcode: row.barcode,
      weightG: row.weightG,
      lengthCm: row.lengthCm,
      widthCm: row.widthCm,
      heightCm: row.heightCm,
      volumetricWeightG,
      chargeableWeightG,
      createdAt: row.createdAt,
      barcodeCheckWarning,
    }
  }

  /** 生成条码校验位提示文案（仅在命中标准且不符时非空） */
  private buildBarcodeWarning(barcode: string | null): string | null {
    if (!barcode) return null
    const res = checkBarcodeDigit(barcode)
    if (res.matched && !res.valid && res.standard && res.expectedCheckDigit) {
      return `${res.standard} 校验位不符，应为 ${res.expectedCheckDigit}（仅提示，已正常保存）`
    }
    return null
  }

  /**
   * 计费重计算（纯函数，便于单测复用）：
   *   体积重 = 长×宽×高 ÷ 抛比系数；计费重 = max(实重, 体积重)。
   */
  static computeWeights(
    weightG: number,
    lengthCm?: number | null,
    widthCm?: number | null,
    heightCm?: number | null,
    divisor: number = DEFAULT_VOLUMETRIC_DIVISOR,
  ): { volumetricWeightG: number; chargeableWeightG: number } {
    const hasDims = lengthCm != null && widthCm != null && heightCm != null
    const volumetric = hasDims
      ? (lengthCm as number) * (widthCm as number) * (heightCm as number) / divisor
      : 0
    const volumetricWeightG = Math.round(volumetric)
    const chargeableWeightG = Math.max(weightG, volumetricWeightG)
    return { volumetricWeightG, chargeableWeightG }
  }
}
