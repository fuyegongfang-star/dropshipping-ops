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
