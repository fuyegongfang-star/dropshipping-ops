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
  remark: string | null // 采购备注（录入侧填写，货代分拣/打包/贴单注意事项）
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
  remark: string | null // 采购备注（分拣装货注意事项，透传给打包作业人员）
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

// ===== 6.8 跨境面单生成（中转仓出单）=====

/** 可选跨境渠道（演示态，生产应经比价/履约路由 1.5 + 承运商适配器建单） */
export interface ChannelOption {
  code: string // yunexpress | dhl | 4px | yanwen
  name: string // 中文名
  currency: string
  baseFee: number // 基础费（CNY）
  perKgRate: number // 每公斤费率（CNY）
}

/** 跨境面单 DTO（绑定打包任务与运单，含 ZPL 源文 + SVG 预览） */
export interface ShippingLabelDto {
  id: string
  tenantId: string
  packTaskId: string | null
  shipmentId: string | null
  channelCode: string
  trackingNo: string | null
  recipient: Record<string, unknown> | null
  zpl: string // ZPL 标签源文
  pdfUrl: string | null // SVG data URI 预览（演示）
  status: string
  createdAt: string
}

/** 生成面单结果（6.8）：返回最新打包任务 + 面单 */
export interface PackLabelResult {
  packTask: PackTaskDto
  label: ShippingLabelDto
}

// ===== 6.9 出库闭环 + 物流同步 =====

/** 出库后跨境物流轨迹节点（6.9）：booked → pushed → picked_up（出库）→ 后续 in_transit… */
export interface OutboundTrackingVo {
  id: string // 轨迹事件 ID
  shipmentId: string // 关联运单
  legType?: string // 物流段（direct/first/last）
  status: string // 归一化节点状态（pushed / picked_up / in_transit …）
  location?: string // 节点地点
  description?: string // 节点描述
  occurredAt: string // 发生时间（ISO8601）
}

/** 出库闭环结果（6.9）：打包任务 + 运单 + 轨迹时间线 + 状态机贯通（采购单/订单） */
export interface OutboundResult {
  packTask: PackTaskDto | null // 最新打包任务快照（已出单/已出库）；按 shipmentId 出库时为 null
  shipment: { id: string; trackingNo: string | null; status: string; channelCode: string | null } // 跨境运单
  tracking: OutboundTrackingVo[] // 出库后的完整轨迹时间线（可在物流轨迹页查看）
  purchaseOrder: { id: string; status: string }[] // 关联采购单状态（packed → outbound）
  order: { id: string; status: string } | null // 关联店铺订单状态（pushed → picked_up）
  message: string // 结果描述（中文）
}
