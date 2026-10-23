import http from './http'

/**
 * 仓储 / 海外仓接口封装（任务 2.2/2.3，方案 §15 海外仓与一件代发）。
 * 对接后端 `WmsController`（/wms）：仓库(国内/海外)、入库预报(ASN)、上架、库存调整、拣货波次。
 * 演示模式由 mock-data.ts 返回等价数据（与 WmsService 同口径）。
 */

export type WarehouseType = 'domestic' | 'overseas'
export type AsnStatus = 'pending' | 'received' | 'closed'
export type PickStatus = 'pending' | 'picking' | 'done'

/** 仓库（归一化返回） */
export interface WarehouseDto {
  id: string
  tenantId: string
  name: string
  type: WarehouseType
  region: string | null
  createdAt: string
}

/** 入库单(ASN)（归一化返回） */
export interface AsnDto {
  id: string
  tenantId: string
  warehouseId: string
  status: AsnStatus
  createdAt: string
}

/** 库存（归一化返回） */
export interface InventoryDto {
  id: string
  tenantId: string
  warehouseId: string
  skuId: string
  binId: string | null
  qty: number
  lockedQty: number
}

/** 拣货任务（归一化返回） */
export interface PickTaskDto {
  id: string
  tenantId: string
  warehouseId: string
  orderId: string | null
  status: PickStatus
  createdAt: string
}

/** 仓库类型中文标签 */
export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  domestic: '国内仓',
  overseas: '海外仓',
}
/** 仓库类型色（Element Plus tag type） */
export const WAREHOUSE_TYPE_TYPE: Record<WarehouseType, string> = {
  domestic: 'primary',
  overseas: 'warning',
}
/** ASN 状态中文标签 */
export const ASN_STATUS_LABELS: Record<AsnStatus, string> = {
  pending: '待收货',
  received: '已收货',
  closed: '已关闭',
}
/** ASN 状态色 */
export const ASN_STATUS_TYPE: Record<AsnStatus, string> = {
  pending: 'info',
  received: 'warning',
  closed: 'success',
}
/** 拣货状态中文标签 */
export const PICK_STATUS_LABELS: Record<PickStatus, string> = {
  pending: '待拣',
  picking: '拣货中',
  done: '已完成',
}
/** 拣货状态色 */
export const PICK_STATUS_TYPE: Record<PickStatus, string> = {
  pending: 'info',
  picking: 'warning',
  done: 'success',
}

export const wmsApi = {
  /** 仓库列表（租户隔离，国内/海外） */
  listWarehouses: () => http.get<WarehouseDto[]>('/wms/warehouses'),
  /** 新建仓库（domestic / overseas；海外仓必填 region） */
  createWarehouse: (body: { name: string; type: WarehouseType; region?: string }) =>
    http.post<WarehouseDto>('/wms/warehouses', body),
  /** 入库单(ASN)列表（可按仓库过滤） */
  listAsns: (warehouseId?: string) =>
    http.get<AsnDto[]>(warehouseId ? `/wms/asns?warehouseId=${encodeURIComponent(warehouseId)}` : '/wms/asns'),
  /** 新建入库预报(ASN) */
  createAsn: (warehouseId: string) => http.post<AsnDto>('/wms/asns', { warehouseId }),
  /** 收货质检：ASN pending → received */
  receiveAsn: (id: string) => http.post<AsnDto>(`/wms/asns/${id}/receive`, {}),
  /** 上架：收货实物入到库位并增加库存 */
  putaway: (id: string, body: { skuId: string; qty: number; binCode: string }) =>
    http.post<InventoryDto>(`/wms/asns/${id}/putaway`, body),
  /** 库存列表（可按仓库过滤） */
  listInventory: (warehouseId?: string) =>
    http.get<InventoryDto[]>(warehouseId ? `/wms/inventory?warehouseId=${encodeURIComponent(warehouseId)}` : '/wms/inventory'),
  /** 库存调整（入库 / 出库 / 盘点损益） */
  adjustInventory: (body: { warehouseId: string; skuId: string; delta: number; binId?: string }) =>
    http.post<InventoryDto>('/wms/inventory/adjust', body),
  /** 拣货任务列表（可按仓库过滤） */
  listPicks: (warehouseId?: string) =>
    http.get<PickTaskDto[]>(warehouseId ? `/wms/picks?warehouseId=${encodeURIComponent(warehouseId)}` : '/wms/picks'),
  /** 创建拣货波次（按订单生成拣货任务） */
  createWave: (warehouseId: string, orderIds?: string[]) =>
    http.post<PickTaskDto[]>('/wms/pick/wave', { warehouseId, orderIds }),
  /** 完成拣货任务 */
  completePick: (id: string) => http.post<PickTaskDto>(`/wms/picks/${id}/complete`, {}),
}
