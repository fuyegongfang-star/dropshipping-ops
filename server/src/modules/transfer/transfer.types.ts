/**
 * 阶段6 货代中转仓作业流 类型定义（任务 6.5 中转仓模型 + 看板）。
 * 看板聚合：本租户中转仓（type=transfer）+ 待作业采购单（已到仓/已匹配/已打包，未出库）+ 关联店铺订单概览。
 */

/** 中转仓（归一化返回） */
export interface TransferWarehouse {
  id: string
  tenantId: string
  name: string
  type: 'transfer'
  region: string | null
  createdAt: string
}

/** 关联店铺订单概览（看板用，避免回传整单） */
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

/** 中转仓看板聚合响应 */
export interface TransferBoard {
  warehouses: TransferWarehouse[]
  purchaseOrders: TransferBoardPo[]
  stats: {
    transferWarehouseCount: number
    pendingPoCount: number
    byStatus: Record<string, number>
  }
}

// ===== 6.7 中转仓打包任务 + 核对 =====

/** 打包任务关联店铺订单概览 */
export interface PackTaskOrderSummary {
  id: string
  platformOrderNo: string | null
  status: string
  recipientName: string | null
}

/** 打包任务聚合的采购单摘要 */
export interface PackTaskPoSummary {
  id: string
  trackingNo: string
  carrier: string
  status: string
}

/** 打包任务核对差异行（采购行项 vs 店铺订单行项，差异高亮，§1/§21） */
export interface PackCheckRow {
  skuId: string | null // 内部 SKU（无则按产品名聚合）
  name: string // 产品名称（回退自采购单）
  orderQty: number // 店铺订单需求数量
  poQty: number // 聚合采购到货数量
  diff: number // poQty - orderQty
  status: 'matched' | 'qty_mismatch' | 'missing_in_po' | 'extra_in_po' | 'unverified'
  message: string // 差异说明（中文，供前端提示）
}

/** 打包任务核对结果 */
export interface PackTaskCheck {
  packTaskId: string
  order: PackTaskOrderSummary | null
  purchaseOrders: PackTaskPoSummary[]
  diffs: PackCheckRow[]
  summary: {
    total: number
    matched: number
    qtyMismatch: number
    missing: number // 订单需求但采购未覆盖（需补采）
    extra: number // 采购到货但订单无需求（需复核）
    unverified: number // 订单行项缺 SKU，无法核对
    hasDifference: boolean // 是否存在需人工复核的差异
  }
}

/** 打包任务（归一化返回，含关联订单与采购单摘要） */
export interface PackTaskDto {
  id: string
  tenantId: string
  warehouseId: string | null
  orderId: string | null
  purchaseOrderIds: string[]
  status: string // pending | packed
  channelCode: string | null
  labelId: string | null
  shipmentId: string | null
  packedAt: string | null
  createdAt: string
  order: PackTaskOrderSummary | null
  purchaseOrders: PackTaskPoSummary[]
}

/** 待打包队列条目（按关联店铺订单聚合的已匹配采购单 + 核对差异预览） */
export interface PackQueueItem {
  orderId: string
  order: PackTaskOrderSummary | null
  purchaseOrders: PackTaskPoSummary[]
  purchaseOrderIds: string[]
  task: { id: string; status: string } | null // 已生成的打包任务（未生成则为 null）
  diffs: PackCheckRow[]
  summary: PackTaskCheck['summary']
}
