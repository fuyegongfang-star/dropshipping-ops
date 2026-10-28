/**
 * 商品/SKU 中心控制器（任务 1.7，方案 §1）。
 * 路由前缀 /catalog：商品（SPU）与内部 SKU 的 CRUD、三段映射维护与解析。
 * 租户 ID 通过 @TenantId 装饰器从 AsyncLocalStorage 注入（§0/§17 行级隔离）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { CatalogService } from './catalog.service'
import { CreateProductDto, ProductResponseDto } from './dto/product.dto'
import { AddSkuBarcodeDto, CreateSkuDto, SkuBarcodeDto, SkuResponseDto, UpdateSkuDto } from './dto/sku.dto'
import { LinkSupplierSkuDto } from './dto/supplier-sku.dto'

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** 创建商品（SPU） */
  @Post('products')
  async createProduct(
    @TenantId() tenantId: string,
    @Body() dto: CreateProductDto,
  ): Promise<ApiResponse<ProductResponseDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.createProduct(tenantId, dto))
  }

  /** 列出租户全部商品（含 SKU） */
  @Get('products')
  async listProducts(@TenantId() tenantId: string): Promise<ApiResponse<ProductResponseDto[]>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.listProducts(tenantId))
  }

  /** 创建内部 SKU */
  @Post('skus')
  async createSku(
    @TenantId() tenantId: string,
    @Body() dto: CreateSkuDto,
  ): Promise<ApiResponse<SkuResponseDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.createSku(tenantId, dto))
  }

  /** 列出租户 SKU（可按 platformSku / supplierSku 过滤） */
  @Get('skus')
  async listSkus(
    @TenantId() tenantId: string,
    @Query('platformSku') platformSku?: string,
    @Query('supplierSku') supplierSku?: string,
  ): Promise<ApiResponse<SkuResponseDto[]>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.listSkus(tenantId, { platformSku, supplierSku }))
  }

  /** 解析平台 SKU → 内部 SKU（§1 平台↔内部映射） */
  @Get('skus/resolve/:platformSku')
  async resolveByPlatformSku(
    @TenantId() tenantId: string,
    @Param('platformSku') platformSku: string,
  ): Promise<ApiResponse<SkuResponseDto | null>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.resolveByPlatformSku(tenantId, platformSku))
  }

  /** 条码反查 SKU（阶段7，任务 7.1）：扫商品码定位内部 SKU */
  @Get('sku/barcode-lookup')
  async barcodeLookup(
    @TenantId() tenantId: string,
    @Query('code') code?: string,
  ): Promise<ApiResponse<import('./dto/sku.dto').BarcodeLookupDto | null>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.lookupByBarcode(tenantId, code ?? ''))
  }

  /** 列出某 SKU 的全部多码（阶段7，任务 7.1） */
  @Get('sku/:skuId/barcodes')
  async listBarcodes(
    @TenantId() tenantId: string,
    @Param('skuId') skuId: string,
  ): Promise<ApiResponse<SkuBarcodeDto[]>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.listBarcodes(tenantId, skuId))
  }

  /** 新增多码（阶段7，任务 7.1）：与 Sku.barcode 互斥去重 */
  @Post('sku/:skuId/barcodes')
  async addBarcode(
    @TenantId() tenantId: string,
    @Param('skuId') skuId: string,
    @Body() dto: AddSkuBarcodeDto,
  ): Promise<ApiResponse<SkuBarcodeDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.addBarcode(tenantId, skuId, dto))
  }

  /** 删除多码（阶段7，任务 7.1） */
  @Delete('sku/barcodes/:id')
  async deleteBarcode(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<null>> {
    this.requireTenant(tenantId)
    await this.catalog.deleteBarcode(tenantId, id)
    return ok(null)
  }

  /** 设为主码（阶段7，任务 7.1）：多码提升为主码，原主码降级为多码 */
  @Patch('sku/:skuId/barcodes/main')
  async setMainBarcode(
    @TenantId() tenantId: string,
    @Param('skuId') skuId: string,
    @Body('barcodeId') barcodeId: string,
  ): Promise<ApiResponse<SkuResponseDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.setMainBarcode(tenantId, skuId, barcodeId))
  }

  /** 部分更新内部 SKU */
  @Patch('skus/:id')
  async updateSku(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSkuDto,
  ): Promise<ApiResponse<SkuResponseDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.updateSku(tenantId, id, dto))
  }

  /** 设定内部 SKU 的平台映射键（§1 平台↔内部） */
  @Post('skus/:id/sync-platform')
  async syncPlatformSku(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body('platformSku') platformSku: string,
  ): Promise<ApiResponse<SkuResponseDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.syncPlatformSku(tenantId, id, platformSku))
  }

  /** 关联供应商 SKU（§21 内部↔供应商映射） */
  @Post('skus/:id/link-supplier')
  async linkSupplierSku(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: LinkSupplierSkuDto,
  ): Promise<ApiResponse<SkuResponseDto>> {
    this.requireTenant(tenantId)
    return ok(await this.catalog.linkSupplierSku(tenantId, id, dto))
  }

  /** 缺租户上下文时显式报错（机制上保证行级隔离不被遗漏，§17） */
  private requireTenant(tenantId?: string): void {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
  }
}
