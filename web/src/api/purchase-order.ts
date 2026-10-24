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
  carrier: string
  platformOrderNo?: string | null
  purchaseUrl?: string | null
  productImages: string[]
  remark?: string | null
  status: PurchaseOrderStatus
  createdAt: string
  updatedAt: string
  items: PurchaseOrderItem[]
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
  purchaseUrl?: string
  productImages?: string[]
  remark?: string
  shopId?: string
  orderId?: string
  items: PurchaseOrderItemInput[]
}

export const purchaseOrderApi = {
  list: (params?: { status?: string; shopId?: string }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.shopId) q.set('shopId', params.shopId)
    const qs = q.toString()
    return http.get<PurchaseOrder[]>(`/purchase-orders${qs ? '?' + qs : ''}`)
  },
  create: (payload: CreatePurchaseOrderPayload) => http.post<PurchaseOrder>('/purchase-orders', payload),
  updateStatus: (id: string, status: PurchaseOrderStatus) =>
    http.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status }),
}
