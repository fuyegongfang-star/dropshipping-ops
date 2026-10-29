/**
 * 采购单 DTO（任务 6.2，方案 §21 衍生 / 阶段6 中转仓作业流）。
 * 采购单 = 货代侧采购/供应商发货登记；经 6.4 匹配店铺订单、6.6 扫码入库、6.7 打包、6.8 出单、6.9 出库。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-24
 */

import {
  ArrayMaxSize,
  IsArray,
  IsDecimal,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

// 采购单状态机（§6）：pending→arrived→matched→packed→outbound（6.6/6.7/6.9 推进）。
export const PURCHASE_ORDER_STATUS = [
  'pending',
  'arrived',
  'matched',
  'packed',
  'outbound',
] as const
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUS)[number]

/** 采购单行项（与店铺 OrderItem 对照，6.7 差异核对，§1/§21） */
export class PurchaseOrderItemDto {
  @IsOptional()
  @IsString()
  skuId?: string // 内部 SKU（关联 §1 商品/SKU 中心）

  @IsString()
  @MaxLength(120)
  productName: string // 产品名称（无 SKU 时必填）

  @IsInt()
  @Min(1)
  quantity: number // 采购数量（≥1）

  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string // 单品图片 URL

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  unitPrice?: number // 单价（采购成本，Decimal 12,2）
}

/** 新增采购单请求体 */
export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  shopId?: string // 来源店铺（绑定渠道，§3）

  @IsOptional()
  @IsString()
  orderId?: string // 关联店铺订单（6.4 关联后回填，§13）

  @IsString()
  @MaxLength(60)
  trackingNo: string // 采购/供应商快递单号（6.6 扫码入库主键）

  @IsString()
  @MaxLength(40)
  carrier: string // 物流公司（采购侧承运方）

  @IsOptional()
  @IsString()
  @MaxLength(40)
  purchaseNo?: string // 业务采购单号（可扫码）；不传由服务端按当日流水自动生成（6.12）

  @IsOptional()
  @IsString()
  @MaxLength(60)
  platformOrderNo?: string // 平台订单号（6.4 精确匹配 Order.platformOrderNo）

  @IsOptional()
  @IsString()
  @MaxLength(60)
  recipientName?: string // 收件人姓名（6.4 与 Order.recipient.name 比对匹配）

  @IsOptional()
  @IsUrl({ require_tld: false })
  purchaseUrl?: string // 采购链接（货源溯源）

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(9)
  productImages?: string[] // 产品图 URL 数组（≤9，演示态压缩后入库，§23）

  @IsOptional()
  @IsString()
  @MaxLength(300)
  remark?: string // 备注

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[] // 至少 1 行（由服务层校验）
}

/** 更新收货标签箱数（7.2 供应商贴箱 → 中转仓一枪到货） */
export class UpdatePurchaseOrderBoxCountDto {
  @IsInt()
  @Min(1)
  @Max(9999)
  boxCount: number // 收货标签箱数（≥1，≤9999，防异常值）
}

/** 更新采购单状态请求体 */
export class UpdatePurchaseOrderStatusDto {
  @IsString()
  @MaxLength(20)
  status: string // 目标状态（需在 §6 状态机合法转移内，由服务层校验）
}

/** 手动关联店铺订单请求体（6.4） */
export class LinkPurchaseOrderDto {
  @IsString()
  @MaxLength(40)
  orderId: string // 目标店铺订单 id（同租户校验，防 IDOR）
}
