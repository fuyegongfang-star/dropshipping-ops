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
  // 实际成本（落 shipment.carrierCost）。建单当下成本尚未回传时为 null（「成本待回传」），
  // 避免被下游利润/对账误计为 0 而系统性高估利润（review C1，§9）。
  carrierCost: number | null
  currency: string // 币种
  estimatedLeadDays?: number // 预计时效（工作日）
  /** 两段式运单（§14）：全程单常被平台拆分为「头程 + 尾程」两段，各自独立运单号。 */
  legs?: ShipmentLegResult[]
}

/**
 * 单段运单（§14 头程/尾程）。
 * 一个全程单（direct）由 first + last 两段组成，每段有独立承运商、运单号、成本与时效，
 * 组合出全程报价与轨迹（尾程优先走聚合平台兜底，§3e/§20）。
 */
export interface ShipmentLegResult {
  legType: LegType // first=头程 / last=尾程（§14）
  carrierCode: string // 该段承运商代码
  carrierName?: string // 承运商展示名（目录回查，运营维护）
  waybillNo: string // 该段运单号
  trackingNo?: string // 该段轨迹号
  labelUrl?: string // 该段面单（落 MinIO，§2.1）
  carrierCost: number | null // 该段成本（落 shipment_legs.cost；未回传时为 null，§9 C1）
  currency: string // 币种
  estimatedLeadDays?: number // 该段时效（工作日）
  transitHub?: string // 转运节点（头程终点 / 尾程起点，如海外仓代码）
}

/** 两段式建单编排结果（§14） */
export interface ComposeShipmentResult {
  orderRef?: string // 关联订单/内部单号
  legs: ShipmentLegResult[] // 各段（1 段=仅头程/仅尾程；2 段=全程）
  totalCarrierCost: number // 各段成本之和（基准币种，§10 归一前）
  currency: string // 币种（取首段币种）
  composedAt: string // 编排完成时间（ISO8601）
}

/** 面单（PDF/ZPL，§3 getLabel） */
export interface CarrierLabel {
  waybillNo: string
  format: 'pdf' | 'zpl' // 输出格式（§1.2.3）
  content?: string // base64 内容（直传）
  url?: string // 下载链接（落 MinIO）
}
