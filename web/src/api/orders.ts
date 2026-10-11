import http from './http'

/** 订单状态中文标签（对齐后端 OrderStatus） */
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_review: '待审',
  approved: '已审通过',
  rejected: '已驳回',
  pushed: '已推单',
  picked_up: '已揽收',
  in_transit: '运输中',
  customs_clearing: '清关中',
  out_for_delivery: '派送中',
  delivered: '已签收',
  completed: '已完成',
  exception: '异常',
  cancelled: '已撤单',
}

/** 合法状态转移表（镜像后端 ALLOWED_TRANSITIONS，用于前端「状态转移」候选） */
export const ORDER_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending_review: ['approved', 'rejected', 'cancelled'],
  approved: ['pushed', 'cancelled'],
  rejected: ['pending_review'],
  pushed: ['picked_up', 'exception', 'cancelled'],
  picked_up: ['in_transit', 'exception'],
  in_transit: ['customs_clearing', 'exception'],
  customs_clearing: ['out_for_delivery', 'exception'],
  out_for_delivery: ['delivered', 'exception'],
  delivered: ['completed', 'exception'],
  completed: [],
  exception: ['in_transit', 'out_for_delivery', 'delivered', 'cancelled'],
  cancelled: [],
}

export const REVERSE_TYPES: Record<string, string> = {
  cancel: '撤单',
  interception: '拦截',
  redirect: '改址',
  return: '退货退款',
}

export interface OrderItem {
  id: string
  skuId: string | null
  quantity: number
  price: number | null
  sku?: { code: string; platformSku: string | null; supplierSku: string | null } | null
}

export interface OrderEvent {
  id: string
  type: string
  from: string | null
  to: string | null
  operator: string | null
  createdAt: string
}

export interface Order {
  id: string
  shopId: string
  platformOrderNo: string
  status: string
  subStatus: string | null
  totalAmount: number | string | null
  currency: string | null
  createdAt: string
  shop?: { id: string; name: string; platform: string } | null
  items?: OrderItem[]
  events?: OrderEvent[]
  recipient?: Record<string, unknown> | null
  reverseOrders?: Array<{ id: string; type: string; status: string; cause: string | null }>
}

export interface ReviewSummary {
  orderId: string
  approved: boolean
  results: Array<{ checkName: string; passed: boolean; reason?: string; skipped?: boolean; note?: string }>
  reasons: string[]
}

export const ordersApi = {
  list: (status?: string) =>
    http.get<Order[]>('/orders' + (status ? `?status=${encodeURIComponent(status)}` : '')),
  detail: (id: string) => http.get<Order>(`/orders/${id}`),
  review: (id: string) =>
    http.post<ReviewSummary>(`/orders/${id}/review`, {}),
  transition: (id: string, to: string, operator = 'admin') =>
    http.post<{ changed: boolean }>(`/orders/${id}/transition`, { to, operator }),
  reverse: (id: string, type: string, cause: string, operator = 'admin') =>
    http.post<{ reverseId: string; status: string }>(`/orders/${id}/reverse`, {
      type,
      cause,
      operator,
    }),
}
