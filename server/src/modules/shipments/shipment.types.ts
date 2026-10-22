/**
 * 物流回传与轨迹（任务 1.6，方案 §3 推单回传 / §6 轨迹与异常 / §21 供应商代发协同）。
 *
 * 本文件定义运单建单、轨迹上报与视图对象的入参/出参类型。
 * - BookShipmentDto：为某订单向承运商建单（下单即生成运单号/轨迹号）。
 * - RecordTrackingDto：写入一条轨迹节点（一般由 Webhook/轮询写入，演示亦可手动推进）。
 * - ShipmentVo / TrackingVo / LegVo：前端可视化所需的归一化视图。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-22
 */

import { IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { CargoType, LegType } from '../carriers/dto/rate.dto'
import { CustomsDto } from '../carriers/dto/shipment.dto'

/** 建单入参：为某订单向承运商下单（§3 createShipment / §21 供应商代发） */
export class BookShipmentDto {
  @IsString()
  orderId!: string // 本系统内部订单 ID（order.id）

  @IsOptional()
  @IsString()
  carrierCode?: string // 承运商代码（默认 mock，演示走无凭证实例）

  @IsOptional()
  @IsEnum(LegType)
  legType?: LegType // 物流段（默认 direct 全程，§14）

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType // 货物类型（默认普货）

  @IsOptional()
  @IsNumber()
  declaredValue?: number // 申报价值（§19 报关）

  @IsOptional()
  @IsString()
  currency?: string // 申报币种（ISO 4217）

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomsDto)
  customs?: CustomsDto // 报关字段（§19）
}

/** 轨迹节点上报入参（§6 基础轨迹；演示亦可手动推进以驱动订单状态） */
export class RecordTrackingDto {
  @IsString()
  shipmentId!: string // 运单 ID（shipment.id）

  @IsString()
  status!: string // 归一化节点状态（picked_up / in_transit / customs_clearing / out_for_delivery / delivered / exception）

  @IsOptional()
  @IsString()
  location?: string // 节点地点

  @IsOptional()
  @IsString()
  description?: string // 节点描述

  @IsOptional()
  @IsString()
  occurredAt?: string // 发生时间（ISO8601，缺省取当前时间）
}

/** 运单视图对象（前端展示用） */
export interface ShipmentVo {
  id: string
  orderId: string
  carrierCode?: string
  carrierName?: string
  trackingNo?: string
  waybillNo?: string
  status: string
  legType: string
  carrierCost?: number
  sellPrice?: number
  currency?: string
  labelUrl?: string
  legs: LegVo[]
  createdAt: string
}

/** 运单分段视图对象（§14 头程/尾程） */
export interface LegVo {
  legType: string
  carrierCode?: string
  carrierName?: string
  trackingNo?: string
  status: string
}

/** 轨迹节点视图对象（§6） */
export interface TrackingVo {
  id: string
  shipmentId: string
  legType?: string
  status: string
  location?: string
  description?: string
  occurredAt: string
}

/** 回传结果（推单到平台，§3 推单回传） */
export interface FulfillResult {
  success: boolean
  message: string
}
