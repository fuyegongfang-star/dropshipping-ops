import http from './http'

// 采购单状态机（§6 阶段6）：pending→arrived→matched→packed→outbound（6.6/6.7/6.9 推进）。
export type PurchaseOrderStatus = 'pending' | 'arrived' | 'matched' | 'packed' | 'outbound'

export interface PurchaseOrderItem {
  id: string
  purchaseOrderId: string
  skuId?: string | null
  productName: string
  quantity: number
  imageUrl?: string | null
  unitPrice?: number | null
  createdAt: string
}

export interface PurchaseOrder {
  id: string
  tenantId: string
  shopId?: string | null
  orderId?: string | null
  trackingNo: string
  /** 业务采购单号（人类可读、可印成条码供扫码枪识别，6.12） */
  purchaseNo?: string | null
  carrier: string
  platformOrderNo?: string | null
  recipientName?: string | null
  purchaseUrl?: string | null
  productImages: string[]
  remark?: string | null
  /** 收货标签箱数（7.2 供应商贴箱 → 中转仓一枪到货；A4/热敏打印拼版用） */
  boxCount: number
  status: PurchaseOrderStatus
  createdAt: string
  updatedAt: string
  items: PurchaseOrderItem[]
}

/** 候选店铺订单 + 命中理由（6.4 匹配预览） */
export interface PurchaseOrderCandidate {
  orderId: string
  platformOrderNo: string
  status: string
  reasons: string[]
}

/** 新增采购单行项（前端草稿） */
export interface PurchaseOrderItemInput {
  skuId?: string
  productName: string
  quantity: number
  imageUrl?: string
  unitPrice?: number
}

export interface CreatePurchaseOrderPayload {
  trackingNo: string
  carrier: string
  platformOrderNo?: string
  recipientName?: string
  purchaseUrl?: string
  productImages?: string[]
  remark?: string
  shopId?: string
  orderId?: string
  items: PurchaseOrderItemInput[]
}

/** 收货标签数据（7.2 供应商贴箱 → 中转仓一枪到货） */
export interface PurchaseOrderLabelData {
  purchaseNo: string
  carrier?: string
  trackingNo?: string
  /** 采购链接（作为溯源/供应商信息展示） */
  supplier?: string | null
  items: { skuCode: string; productName: string; quantity: number }[]
  remark?: string | null
  boxCount: number
  /** 打印时间（ISO 字符串），由服务端生成 */
  printedAt: string
}

export const purchaseOrderApi = {
  list: (params?: { status?: string; shopId?: string; orderId?: string }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.shopId) q.set('shopId', params.shopId)
    if (params?.orderId) q.set('orderId', params.orderId)
    const qs = q.toString()
    return http.get<PurchaseOrder[]>(`/purchase-orders${qs ? '?' + qs : ''}`)
  },
  create: (payload: CreatePurchaseOrderPayload) => http.post<PurchaseOrder>('/purchase-orders', payload),
  updateStatus: (id: string, status: PurchaseOrderStatus) =>
    http.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }),
  // 7.2 收货标签：标签数据 + 更新箱数
  getLabelData: (id: string) =>
    http.get<PurchaseOrderLabelData>(`/purchase-orders/${id}/label-data`),
  updateBoxCount: (id: string, boxCount: number) =>
    http.patch<PurchaseOrder>(`/purchase-orders/${id}`, { boxCount }),
  // 6.4 匹配 / 关联
  candidates: (id: string) =>
    http.get<PurchaseOrderCandidate[]>(`/purchase-orders/${id}/candidates`),
  autoMatch: (id: string) =>
    http.post<{ linked: boolean; orderId: string | null; reasons: string[]; message: string }>(
      `/purchase-orders/${id}/auto-match`,
      {},
    ),
  link: (id: string, orderId: string) =>
    http.post<PurchaseOrder>(`/purchase-orders/${id}/link`, { orderId }),
  unlink: (id: string) => http.post<PurchaseOrder>(`/purchase-orders/${id}/unlink`, {}),
}
