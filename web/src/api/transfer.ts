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

// ===== 6.7 中转仓打包任务 + 核对 类型 =====

/** 核对差异行（采购行项 vs 店铺订单行项） */
export interface PackCheckRow {
  skuId: string | null
  name: string
  orderQty: number
  poQty: number
  diff: number
  status: 'matched' | 'qty_mismatch' | 'missing_in_po' | 'extra_in_po' | 'unverified'
  message: string
}

/** 核对差异汇总 */
export interface PackCheckSummary {
  total: number
  matched: number
  qtyMismatch: number
  missing: number
  extra: number
  unverified: number
  hasDifference: boolean
}

/** 打包任务（归一化，含关联订单与采购单摘要） */
export interface PackTaskDto {
  id: string
  tenantId: string
  warehouseId: string | null
  orderId: string | null
  purchaseOrderIds: string[]
  status: string
  channelCode: string | null
  labelId: string | null
  shipmentId: string | null
  packedAt: string | null
  createdAt: string
  order: { id: string; platformOrderNo: string | null; status: string; recipientName: string | null } | null
  purchaseOrders: { id: string; trackingNo: string; carrier: string; status: string }[]
}

/** 待打包队列条目（按关联订单聚合的已匹配采购单 + 核对预览） */
export interface PackQueueItem {
  orderId: string
  order: { id: string; platformOrderNo: string | null; status: string; recipientName: string | null } | null
  purchaseOrders: { id: string; trackingNo: string; carrier: string; status: string }[]
  purchaseOrderIds: string[]
  task: { id: string; status: string } | null
  diffs: PackCheckRow[]
  summary: PackCheckSummary
}

/** 待打包队列聚合响应 */
export interface PackQueue {
  items: PackQueueItem[]
  stats: { matchedPoCount: number; taskCount: number; pendingTaskCount: number; packedTaskCount: number }
}

/** 打包任务核对结果（6.7） */
export interface PackTaskCheck {
  packTaskId: string
  order: { id: string; platformOrderNo: string | null; status: string; recipientName: string | null } | null
  purchaseOrders: { id: string; trackingNo: string; carrier: string; status: string }[]
  diffs: PackCheckRow[]
  summary: PackCheckSummary
}

// ===== 6.8 跨境面单生成（中转仓出单）=====

/** 可选跨境渠道（演示态） */
export interface ChannelOption {
  code: string
  name: string
  currency: string
  baseFee: number
  perKgRate: number
}

/** 跨境面单（6.8） */
export interface ShippingLabelDto {
  id: string
  tenantId: string
  packTaskId: string | null
  shipmentId: string | null
  channelCode: string
  trackingNo: string | null
  recipient: Record<string, unknown> | null
  zpl: string
  pdfUrl: string | null
  status: string
  createdAt: string
}

/** 生成面单结果（6.8） */
export interface PackLabelResult {
  packTask: PackTaskDto
  label: ShippingLabelDto
}

/** 生成面单请求体（6.8） */
export interface GenerateLabelDto {
  channelCode: string
}

export const transferApi = {
  /** 中转仓看板（6.5）：中转仓 + 待作业采购单 + 关联订单概览 */
  board: () => http.get<TransferBoard>('/transfer/board'),
  /** 扫码到货入库（6.6）：快递单号/SKU 条码/采购单号 → 解析采购单 → 到货登记 → 状态推进 → 匹配订单 */
  scan: (dto: ScanTransferDto) => http.post<ScanTransferResult>('/transfer/scan', dto),
  /** 待打包队列（6.7）：已匹配订单聚合 + 核对差异预览 */
  packQueue: () => http.get<PackQueue>('/transfer/pack-queue'),
  /** 生成打包任务（6.7）：幂等，按订单聚合创建 */
  generatePackTasks: () => http.post<{ created: number; tasks: PackTaskDto[] }>('/transfer/pack-tasks/generate'),
  /** 打包任务列表（6.7） */
  listPackTasks: () => http.get<PackTaskDto[]>('/transfer/pack-tasks'),
  /** 打包任务核对（6.7）：采购行项 vs 订单行项 */
  packCheck: (id: string) => http.get<PackTaskCheck>(`/transfer/pack-tasks/${id}/check`),
  /** 标记打包（6.7）：推进采购单状态 + 置任务为 packed */
  pack: (id: string) => http.post<PackTaskDto>(`/transfer/pack-tasks/${id}/pack`),
  /** 可选跨境渠道（6.8） */
  channels: () => http.get<ChannelOption[]>('/transfer/channels'),
  /** 生成跨境面单（6.8）：选渠道 → 建单 + 出 ZPL/预览面单，回填打包任务 */
  generateLabel: (id: string, dto: GenerateLabelDto) => http.post<PackLabelResult>(`/transfer/pack-tasks/${id}/label`, dto),
  /** 查看跨境面单（6.8） */
  getLabel: (id: string) => http.get<ShippingLabelDto>(`/transfer/pack-tasks/${id}/label`),
}
