/**
 * 承运商比价/运费试算归一化 DTO（方案 §3 getRates / §4 运费试算）。
 * 各承运商原始报价经适配器转换为 RateQuote[]，上层（比价引擎 §5 / 加价层 §10）复用。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

/** 单箱（重量 kg / 尺寸 cm） */
export class ParcelDto {
  @IsNumber()
  @Min(0)
  weightKg!: number // 实重（kg）

  @IsNumber()
  @Min(0)
  lengthCm!: number // 长（cm）

  @IsNumber()
  @Min(0)
  widthCm!: number // 宽（cm）

  @IsNumber()
  @Min(0)
  heightCm!: number // 高（cm）
}

/** 货物类型（决定渠道可达性与附加费，§4.3） */
export enum CargoType {
  GENERAL = 'general', // 普货
  BATTERY = 'battery', // 带电
  LIQUID = 'liquid', // 液体
  POWDER = 'powder', // 粉末
  BRAND = 'brand', // 品牌
  SENSITIVE = 'sensitive', // 敏感货
}

/** 物流段（§14 头程/尾程/全程） */
export enum LegType {
  FIRST = 'first', // 头程
  LAST = 'last', // 尾程
  DIRECT = 'direct', // 全程
}

/** 试算输入（REST 入参，§4.3） */
export class GetRatesRequest {
  @IsOptional()
  @IsString()
  origin?: string // 始发地（如 深圳/广州 仓）

  @IsString()
  destCountry!: string // 目的国（ISO2）

  @IsOptional()
  @IsString()
  destZip?: string // 目的邮编（分区与可达性，§18）

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  parcels!: ParcelDto[] // 包裹列表（≥1，多箱 Σ 计费重，§4.2）

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType // 货物类型（默认普货）

  @IsOptional()
  @IsNumber()
  declaredValue?: number // 申报价值（部分渠道必填）

  @IsOptional()
  @IsString()
  currency?: string // 申报币种（ISO 4217）

  @IsOptional()
  @IsEnum(LegType)
  legType?: LegType // 物流段（默认全程）

  @IsOptional()
  @IsString()
  servicePreference?: string // 时效优先/价格优先/指定渠道（§4.3）
}

/** 附加费明细（§4.4） */
export interface SurchargeItem {
  type: string // fuel/remote/oversize/duty_prepaid...
  name: string // 展示名（如 燃油附加费）
  amount: number // 金额（本币）
  currency: string // 币种
}

/** 归一化报价（比价引擎/加价层共用的统一结构） */
export interface RateQuote {
  carrierCode: string // 承运商代码
  productCode: string // 物流产品代码（对齐 LogisticsProduct）
  productName: string // 产品名（如「云途-标准专线」）
  chargeableWeightKg: number // 计费重（kg）
  volumetricWeightKg: number // 体积重（kg，提示抛货）
  isVolumetric: boolean // 是否抛货（体积重 > 实重）
  currency: string // 币种（ISO 4217）
  carrierCost: number // 承运商成本（仅运营可见，§4.3；经 §10 币种归一后为基准币种）
  sellPrice?: number // 加价后售价（商户可见，基准币种，§4.3/§10；比价引擎填充）
  margin?: number // 平台利润 = sellPrice − carrierCost（基准币种，§10.1）
  fxRateSnapshot?: { from: string; to: string; rate: number; effectiveAt?: string } // 币种归一汇率快照（§10.3/§10.6）
  estimatedLeadDaysMin?: number // 预计时效下限（工作日）
  estimatedLeadDaysMax?: number // 预计时效上限（工作日）
  reachable: boolean // 是否可达（不可达需说明原因）
  surcharges?: SurchargeItem[] // 附加费明细（§4.4）
  remoteArea?: boolean // 是否偏远地区（触发偏远附加费）
  note?: string // 不可达/限制说明
}
