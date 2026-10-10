/**
 * 渠道拉单归一化 DTO（方案 §3 统一出站/入站 DTO 归一化）。
 * 各平台原始订单经适配器转换为本结构，再落库；保证上层（订单归集/审单）与平台解耦。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ChannelOrderStatus } from '../channel.constants'

/** 归一化订单明细 */
export class ChannelOrderItemDto {
  @IsOptional()
  @IsString()
  platformSku?: string // 平台侧 SKU（用于与内部 SKU 映射，§1）

  @IsString()
  skuCode!: string // 内部 SKU 编码（系统侧唯一键，见 Sku.code）

  @IsString()
  title!: string // 商品标题

  @IsInt()
  @Min(1)
  quantity!: number // 购买数量（件）

  @IsOptional()
  @IsString()
  currency?: string // 币种（ISO 4217），与订单币种一致

  @IsOptional()
  @IsNumber()
  price?: number // 单价（最小货币单位/明确小数，见 Order.totalAmount 约定）
}

/** 归一化收件人（PII 落库需脱敏/加密，见 §17） */
export class ChannelRecipientDto {
  @IsString()
  name!: string // 收件人姓名

  @IsOptional()
  @IsString()
  phone?: string // 联系电话

  @IsOptional()
  @IsString()
  email?: string // 邮箱

  @IsString()
  country!: string // 国家代码（ISO2，如 US/GB/DE）

  @IsOptional()
  @IsString()
  state?: string // 州/省

  @IsString()
  city!: string // 城市

  @IsString()
  address1!: string // 地址行 1

  @IsOptional()
  @IsString()
  address2?: string // 地址行 2

  @IsOptional()
  @IsString()
  zip?: string // 邮编（分区与可达性判定输入，§18）
}

/** 归一化渠道订单（拉单产出） */
export class PulledChannelOrderDto {
  @IsString()
  platformOrderNo!: string // 平台原始订单号（唯一键，见 Order.platformOrderNo）

  @IsEnum(ChannelOrderStatus)
  status!: ChannelOrderStatus // 渠道侧状态（归一化）

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChannelOrderItemDto)
  items!: ChannelOrderItemDto[] // 订单明细（≥1 条）

  @ValidateNested()
  @Type(() => ChannelRecipientDto)
  recipient!: ChannelRecipientDto // 收件人

  @IsOptional()
  @IsString()
  currency?: string // 订单币种（ISO 4217）

  @IsOptional()
  @IsDateString()
  placedAt?: string // 下单时间（UTC ISO）

  @IsOptional()
  @IsNumber()
  totalAmount?: number // 订单总额（币种见 currency；落 Order.totalAmount，§7 金额单位 Decimal(12,2)）
}

/**
 * 拉单返回结果：归一化订单 + 平台原始响应。
 * raw 用于落 `Order.raw`（JSONB），保留溯源，便于排障与对账（§3）。
 */
export interface PulledChannelOrderResult {
  order: PulledChannelOrderDto
  raw: unknown // 平台原始响应（不校验，原样保留）
}
