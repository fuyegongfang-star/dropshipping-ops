import http from './http'

/** 中转仓（归一化） */
export interface TransferWarehouse {
  id: string
  tenantId: string
  name: string
  type: 'transfer'
  region: string | null
  createdAt: string
}

/** 关联店铺订单概览（看板用） */
export interface LinkedOrderSummary {
  id: string
  platformOrderNo: string | null
  status: string
  recipientName: string | null
}

/** 看板采购单（带关联订单概览） */
export interface TransferBoardPo {
  id: string
  tenantId: string
  shopId: string | null
  orderId: string | null
  trackingNo: string
  carrier: string
  platformOrderNo: string | null
  recipientName: string | null
  status: string
  items: { id: string; productName: string; quantity: number; skuId: string | null }[]
  order: LinkedOrderSummary | null
}

/** 中转仓看板聚合 */
export interface TransferBoard {
  warehouses: TransferWarehouse[]
  purchaseOrders: TransferBoardPo[]
  stats: {
    transferWarehouseCount: number
    pendingPoCount: number
    byStatus: Record<string, number>
  }
}

/** 扫码来源类型（6.6 扫码到货入库） */
export type ScanType = 'trackingNo' | 'barcode' | 'purchaseNo'

/** 扫码到货入库请求体（6.6） */
export interface ScanTransferDto {
  warehouseId: string
  scanValue: string
  scanType: ScanType
}

/** 扫码到货入库返回（6.6）：收货单 + 采购单快照 + 匹配/推进标记 */
export interface ScanTransferResult {
  asn: {
    id: string
    warehouseId: string
    purchaseOrderId: string | null
    scanSource: string
    status: string
    receivedItemCount: number
    createdAt: string
  }
  purchaseOrder: { id: string; trackingNo: string; carrier: string; status: string; orderId: string | null }
  matched: boolean
  advanced: boolean
  message: string
}

export const transferApi = {
  /** 中转仓看板（6.5）：中转仓 + 待作业采购单 + 关联订单概览 */
  board: () => http.get<TransferBoard>('/transfer/board'),
  /** 扫码到货入库（6.6）：快递单号/SKU 条码/采购单号 → 解析采购单 → 到货登记 → 状态推进 → 匹配订单 */
  scan: (dto: ScanTransferDto) => http.post<ScanTransferResult>('/transfer/scan', dto),
}
