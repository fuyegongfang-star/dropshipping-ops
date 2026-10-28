/**
 * 内部 SKU DTO（任务 1.7，方案 §1 商品/SKU 中心 / §4 运费试算）。
 * SKU 为「内部标准编码」，承载重量/尺寸用于计费重计算；platformSku/supplierSku
 * 分别为平台侧与供应商侧映射键（平台↔内部↔供应商三段映射，§1）。
 */

import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

/** 创建内部 SKU 入参 */
export class CreateSkuDto {
  @IsString()
  productId!: string // 所属商品（SPU）

  @IsString()
  @MaxLength(64)
  code!: string // 内部 SKU 编码（租户内唯一，见 Sku.code）

  @IsOptional()
  @IsString()
  @MaxLength(128)
  platformSku?: string // 平台侧 SKU（映射键，§1）

  @IsOptional()
  @IsString()
  @MaxLength(128)
  supplierSku?: string // 供应商侧 SKU（冗余字段，便于快速取用；权威来源为 SupplierSku 表）

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string

  @IsInt()
  @Min(0)
  weightG!: number // 实重（克）—— 计费重输入（§4）

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthCm?: number // 长（厘米）

  @IsOptional()
  @IsInt()
  @Min(0)
  widthCm?: number // 宽（厘米）

  @IsOptional()
  @IsInt()
  @Min(0)
  heightCm?: number // 高（厘米）—— 体积重 = 长×宽×高 ÷ 抛比
}

/** 更新内部 SKU 入参（全字段可选，部分更新） */
export class UpdateSkuDto {
  @IsOptional()
  @IsString()
  productId?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  platformSku?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  supplierSku?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  weightG?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  lengthCm?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  widthCm?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  heightCm?: number
}

/** 内部 SKU 响应（含计费重派生字段） */
export class SkuResponseDto {
  id!: string
  tenantId!: string
  productId!: string
  code!: string
  platformSku?: string | null
  supplierSku?: string | null
  barcode?: string | null
  weightG!: number
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  volumetricWeightG!: number // 体积重（克）
  chargeableWeightG!: number // 计费重（克）= max(实重, 体积重)
  createdAt!: Date
  /** 条码校验位提示：仅当命中 EAN-13/UPC-A 标准且校验位不符时给出建议（不拦截录入） */
  barcodeCheckWarning?: string | null
}

/** SKU 多码（阶段7，任务 7.1） */
export class SkuBarcodeDto {
  id!: string
  tenantId!: string
  skuId!: string
  code!: string
  kind!: string // supplier | internal | ean13 | other
  createdAt!: Date
}

/** 新增 SKU 多码入参 */
export class AddSkuBarcodeDto {
  @IsString()
  code!: string // 条码明文

  @IsOptional()
  @IsString()
  @MaxLength(16)
  kind?: string // 不传默认 other
}

/** 条码反查结果（扫码枪定位 SKU / 后续 PDA 复用） */
export class BarcodeLookupDto {
  skuId!: string
  code!: string
  productName!: string
  matchedBy!: 'main' | 'alt' // main=命中 Sku.barcode；alt=命中 SkuBarcode 多码
  kind?: string | null
}
