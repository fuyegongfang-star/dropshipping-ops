import http from './http'

/**
 * 供应商代发接口封装（任务 1.9，方案 §21 供应商代发履约链路）。
 * 对接后端 `SuppliersController`（/suppliers）：供应商档案 + 代发单（推单）创建与状态推进。
 * 演示模式由 mock-data.ts 返回等价数据（与 SuppliersService 同口径）。
 */

/** 供应商档案 */
export interface SupplierDto {
  id: string
  tenantId: string
  name: string
  createdAt: string
}

/** 代发单状态（§21 状态机：pushed → accepted → shipped → done） */
export type SupplierOrderStatus = 'pushed' | 'accepted' | 'shipped' | 'done'

/** 代发单（归一化返回） */
export interface SupplierOrderDto {
  id: string
  tenantId: string
  supplierId: string
  orderId: string | null
  status: SupplierOrderStatus
  createdAt: string
}

/** 代发单状态中文标签 */
export const SUPPLIER_ORDER_STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  pushed: '已推送',
  accepted: '已接单',
  shipped: '已发货',
  done: '已完成',
}

/** 状态流转顺序（用于推算「下一步」按钮） */
export const SUPPLIER_ORDER_FLOW: SupplierOrderStatus[] = ['pushed', 'accepted', 'shipped', 'done']

/** 代发单状态色（Element Plus tag type） */
export const SUPPLIER_ORDER_STATUS_TYPE: Record<SupplierOrderStatus, string> = {
  pushed: 'info',
  accepted: 'warning',
  shipped: 'primary',
  done: 'success',
}

export const suppliersApi = {
  /** 供应商档案列表（租户隔离） */
  listSuppliers: () => http.get<SupplierDto[]>('/suppliers'),
  /** 新建供应商档案 */
  createSupplier: (name: string) => http.post<SupplierDto>('/suppliers', { name }),
  /** 代发单列表（租户隔离） */
  listOrders: () => http.get<SupplierOrderDto[]>('/suppliers/orders'),
  /** 新建代发单（推单） */
  createOrder: (supplierId: string, orderId?: string) =>
    http.post<SupplierOrderDto>('/suppliers/orders', { supplierId, orderId }),
  /** 推进代发单状态 */
  advance: (id: string, to: SupplierOrderStatus) =>
    http.patch<SupplierOrderDto>(`/suppliers/orders/${id}/advance`, { to }),
}
