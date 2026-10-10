/**
 * 商品（SPU）DTO（任务 1.7，方案 §1 商品/SKU 中心）。
 * 入参做 class-validator 校验，出参为只读响应结构（与持久层解耦）。
 */

import { IsOptional, IsString, MaxLength } from 'class-validator'
import { SkuResponseDto } from './sku.dto'

/** 创建商品（SPU）入参 */
export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  title!: string // 商品标题

  @IsOptional()
  @IsString()
  @MaxLength(64)
  spu?: string // 标准产品单元编码（可选，便于外部系统对齐）
}

/** 更新商品入参（全字段可选） */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  spu?: string
}

/** 商品响应（含其下 SKU 列表） */
export class ProductResponseDto {
  id!: string
  tenantId!: string
  title!: string
  spu?: string | null
  createdAt!: Date
  skus!: SkuResponseDto[]
}
