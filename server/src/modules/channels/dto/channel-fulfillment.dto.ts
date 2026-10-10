/**
 * 渠道回传 / 轨迹 归一化 DTO（方案 §3 推单回传 / 轨迹）。
 * 回传：将本平台生成的运单号回写渠道，标记平台订单已发货。
 * 轨迹：查询渠道侧订单/物流状态。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ChannelOrderStatus } from '../channel.constants'

/** 实际发货明细（回传时按 SKU 行回写） */
export class FulfillmentLineItemDto {
  @IsString()
  platformSku!: string // 平台侧 SKU

  @IsString()
  quantity!: number // 发货数量（件）
}

/** 回传请求：把运单号回写渠道（§3 推单回传） */
export class ChannelFulfillmentDto {
  @IsString()
  platformOrderNo!: string // 平台原始订单号（定位渠道订单）

  @IsString()
  trackingNo!: string // 运单号（本平台生成 / 承运商回传）

  @IsOptional()
  @IsString()
  carrierName?: string // 承运商名称（渠道展示用）

  @IsOptional()
  @IsString()
  shippedAt?: string // 发货时间（UTC ISO）

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FulfillmentLineItemDto)
  lineItems?: FulfillmentLineItemDto[] // 实际发货明细
}

/** 回传结果 */
export interface ChannelFulfillmentResult {
  platformOrderNo: string
  success: boolean // 回传是否成功
  trackingNo?: string // 回写后的运单号
  message?: string // 失败原因 / 渠道返回消息
}

/** 轨迹节点 */
export interface ChannelTrackingEvent {
  status: string // 节点状态（如 in_transit / delivered）
  location?: string // 地点
  occurredAt: string // 发生时间（UTC ISO）
  description?: string // 节点描述
}

/** 轨迹查询结果 */
export interface ChannelTrackingResult {
  platformOrderNo: string
  trackingNo?: string
  status: ChannelOrderStatus // 归一化状态
  events: ChannelTrackingEvent[] // 轨迹节点列表
}
