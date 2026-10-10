/**
 * 供应商 SKU 关联 DTO（任务 1.7 / §21 供应商代发链路）。
 * 内部 SKU ↔ 供应商 SKU 映射：一个内部 SKU 可对应多个供应商，供应商侧编码各异。
 */

import { IsString, MaxLength } from 'class-validator'

/** 关联供应商 SKU 入参（建立/更新 内部 SKU ↔ 供应商 SKU 映射） */
export class LinkSupplierSkuDto {
  @IsString()
  supplierId!: string // 供应商 ID（Supplier.id）

  @IsString()
  @MaxLength(128)
  supplierSku!: string // 供应商侧 SKU 编码
}
