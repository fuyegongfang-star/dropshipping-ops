import { IsIn, IsNotEmpty, IsString } from 'class-validator'

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
