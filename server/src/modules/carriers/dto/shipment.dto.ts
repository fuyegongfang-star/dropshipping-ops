/**
 * 承运商建单/面单 归一化 DTO（方案 §3 createShipment / getLabel）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { CargoType, LegType, ParcelDto } from './rate.dto'

/** 收件人（PII 落库需脱敏/加密，§17） */
export class CarrierRecipientDto {
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

/** 报关/合规字段（挂在 shipment 上，§19；影响 order→shipment 映射） */
export class CustomsDto {
  @IsOptional()
  @IsString()
  hsCode?: string // HS 编码

  @IsOptional()
  @IsString()
  ioss?: string // IOSS（欧盟 VAT 简化）

  @IsOptional()
  @IsString()
  eori?: string // EORI

  @IsOptional()
  @IsString()
  vat?: string // VAT 号

  @IsOptional()
  @IsString()
  dutyPrepaid?: string // 关税预付方式 DDP/DDU
}

/** 建单请求（推单入参，§3 createShipment / §21 供应商代发） */
export class CreateShipmentRequest {
  @IsOptional()
  @IsString()
  orderRef?: string // 平台/内部单号（关联订单）

  @IsString()
  origin!: string // 始发仓/地

  @IsString()
  destCountry!: string // 目的国（ISO2）

  @IsOptional()
  @IsString()
  destZip?: string // 目的邮编

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParcelDto)
  parcels!: ParcelDto[] // 包裹列表（≥1）

  @IsOptional()
  @ValidateNested()
  @Type(() => CarrierRecipientDto)
  recipient?: CarrierRecipientDto // 收件人（代发链路需回传平台，§21）

  @IsOptional()
  @IsEnum(CargoType)
  cargoType?: CargoType // 货物类型（默认普货）

  @IsOptional()
  @IsNumber()
  declaredValue?: number // 申报价值

  @IsOptional()
  @IsString()
  currency?: string // 币种（ISO 4217）

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomsDto)
  customs?: CustomsDto // 报关字段（§19）

  @IsOptional()
  @IsEnum(LegType)
  legType?: LegType // 物流段（§14）

  @IsOptional()
  @IsString()
  servicePreference?: string // 指定渠道/服务偏好
}

/** 建单结果 */
export interface CreateShipmentResult {
  waybillNo: string // 承运商运单号
  trackingNo?: string // 轨迹号（部分承运商与运单号不同）
  labelUrl?: string // 面单下载链接（落 MinIO，§2.1）
  labelZpl?: string // 面单 ZPL（热敏，§1.2.3）
  carrierCost: number // 实际成本（落 shipment.carrierCost）
  currency: string // 币种
  estimatedLeadDays?: number // 预计时效（工作日）
}

/** 面单（PDF/ZPL，§3 getLabel） */
export interface CarrierLabel {
  waybillNo: string
  format: 'pdf' | 'zpl' // 输出格式（§1.2.3）
  content?: string // base64 内容（直传）
  url?: string // 下载链接（落 MinIO）
}
