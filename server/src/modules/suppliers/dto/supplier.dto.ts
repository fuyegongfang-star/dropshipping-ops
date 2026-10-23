/**
 * 供应商代发 DTO（任务 1.9，方案 §21 供应商代发履约链路）。
 * 入口参数校验：供应商档案创建、代发单创建、状态推进。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

/** 创建供应商档案：名称必填 */
export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  name: string // 供应商名称
}

/** 创建供应商代发单（推单）：供应商必填，关联订单可选 */
export class CreateSupplierOrderDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string // 供应商 ID（必须属于当前租户）

  @IsOptional()
  @IsString()
  orderId?: string // 关联平台订单 ID（可选）
}

/** 推进代发单状态：仅允许向前一步或直达 done */
export class AdvanceSupplierOrderDto {
  @IsIn(['accepted', 'shipped', 'done'])
  to: 'accepted' | 'shipped' | 'done'
}
