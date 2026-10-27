import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

/** 扫码来源类型（6.6 扫码到货入库） */
export type ScanType = 'trackingNo' | 'barcode' | 'purchaseNo'

/** 扫码到货入库请求体（6.6） */
export class ScanTransferDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string // 目标中转仓（须属于当前租户）

  @IsString()
  @IsNotEmpty()
  scanValue: string // 扫码值：快递单号 / SKU 条码 / 采购单号

  @IsIn(['trackingNo', 'barcode', 'purchaseNo'])
  scanType: ScanType // 解析维度
}

/** 可选跨境渠道（6.8 中转仓出单，演示态编码白名单） */
export const TRANSFER_CHANNEL_CODES = ['yunexpress', 'dhl', '4px', 'yanwen'] as const
export type TransferChannelCode = (typeof TRANSFER_CHANNEL_CODES)[number]

/** 生成跨境面单请求体（6.8） */
export class GenerateLabelDto {
  @IsIn(TRANSFER_CHANNEL_CODES)
  channelCode: TransferChannelCode // 跨境渠道（云途 / DHL / 4PX / 燕文）
}

/**
 * 出库闭环请求体（6.9 出库闭环 + 物流同步）。
 * 两种定位方式二选一：① packTaskId（中转仓出单任务，最常用）② shipmentId（直接指定跨境运单）。
 * 校验：目标任务必须已生成跨境面单（labelId/shipmentId 就绪），否则不允许出库。
 */
export class OutboundTransferDto {
  @IsOptional()
  @IsString()
  packTaskId?: string // 中转仓打包/出单任务 ID（6.8 已生成面单）

  @IsOptional()
  @IsString()
  shipmentId?: string // 直接指定跨境运单 ID

  // 至少提供其一（class-validator 仅做类型校验，业务校验在 service 内完成）
}
