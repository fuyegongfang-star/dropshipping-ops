/**
 * 物流产品目录 / 费率卡 DTO（任务 4.6，方案 §4 / §23 运营配置后台）。
 * 物流产品是货代的核心资产：合约价 + 自定产品（承运商下挂多个产品，如云途→标准专线/经济专线）。
 * 费率卡字段：首重价 + 续重价（按基准币种），配合抛比系数计算计费重成本。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-16
 */

import { IsString, IsOptional, IsInt, IsNumber, IsBoolean, IsIn } from 'class-validator'
import type { LegType } from '../../carriers/dto/rate.dto'

/** 创建物流产品入参 */
export class CreateLogisticsProductDto {
  /** 承运商编码（yunexpress|dhl|4px|yanwen） */
  @IsString()
  carrierCode!: string

  /** 产品名（如「云途-标准专线」） */
  @IsString()
  name!: string

  /** 物流段：first（头程）/ last（尾程）/ direct（全程） */
  @IsOptional()
  @IsIn(['first', 'last', 'direct'])
  legType?: LegType

  /** 目的区（ZONE_1..5 或 ALL） */
  @IsOptional()
  @IsString()
  destZone?: string

  /** 时效下限（天） */
  @IsOptional()
  @IsInt()
  transitDaysMin?: number

  /** 时效上限（天） */
  @IsOptional()
  @IsInt()
  transitDaysMax?: number

  /** 抛比系数（体积重 = 长×宽×高 / 抛比） */
  @IsOptional()
  @IsInt()
  volumetricDivisor?: number

  /** 允许货物类型：normal|battery|liquid|sensitive */
  @IsOptional()
  @IsIn(['normal', 'battery', 'liquid', 'sensitive'])
  cargoTypeAllowed?: string

  /** 可达国家（ISO2，逗号分隔，空=不限） */
  @IsOptional()
  @IsString()
  reachableCountries?: string

  /** 首重价（基准币种） */
  @IsOptional()
  @IsNumber()
  firstWeightPrice?: number

  /** 续重价（基准币种/kg） */
  @IsOptional()
  @IsNumber()
  additionalWeightPrice?: number

  /** 费率卡基准币种 */
  @IsOptional()
  @IsString()
  currency?: string

  /** 是否启用 */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  /** 是否默认产品 */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  /** 租户可见性 */
  @IsOptional()
  @IsBoolean()
  visible?: boolean
}

/** 更新物流产品入参（全字段可选，部分更新） */
export class UpdateLogisticsProductDto {
  @IsOptional()
  @IsString()
  carrierCode?: string

  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsIn(['first', 'last', 'direct'])
  legType?: LegType

  @IsOptional()
  @IsString()
  destZone?: string

  @IsOptional()
  @IsInt()
  transitDaysMin?: number

  @IsOptional()
  @IsInt()
  transitDaysMax?: number

  @IsOptional()
  @IsInt()
  volumetricDivisor?: number

  @IsOptional()
  @IsIn(['normal', 'battery', 'liquid', 'sensitive'])
  cargoTypeAllowed?: string

  @IsOptional()
  @IsString()
  reachableCountries?: string

  @IsOptional()
  @IsNumber()
  firstWeightPrice?: number

  @IsOptional()
  @IsNumber()
  additionalWeightPrice?: number

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean

  @IsOptional()
  @IsBoolean()
  visible?: boolean
}

/** 产品对外输出（Decimal 已转为 number，便于 JSON 序列化） */
export interface LogisticsProductOut {
  id: string
  tenantId: string
  carrierCode: string
  name: string
  legType: string
  destZone: string
  transitDaysMin: number
  transitDaysMax: number
  volumetricDivisor: number
  cargoTypeAllowed: string
  reachableCountries: string
  firstWeightPrice: number
  additionalWeightPrice: number
  currency: string
  enabled: boolean
  isDefault: boolean
  visible: boolean
  createdAt: string
  updatedAt: string
}

/** 费率卡试算结果 */
export interface RateCardQuote {
  productId: string
  productName: string
  carrierCode: string
  weightKg: number
  carrierCost: number
  currency: string
  transitDays: string
}
