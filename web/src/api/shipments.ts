import http from './http'

/**
 * 物流回传与轨迹接口封装（任务 1.6，方案 §3 推单回传 / §6 轨迹与异常）。
 * 对接后端 /shipments：建单 / 回传平台 / 轨迹上报 / 轨迹查询 / 运单列表。
 * 演示模式下由 mock-data.ts 返回等价数据（与承运商建单/渠道回传同口径）。
 */

/** 运单分段（§14 头程/尾程） */
export interface ShipmentLegVo {
  legType: string
  carrierCode?: string
  carrierName?: string
  trackingNo?: string
  status: string
}

/** 运单视图对象 */
export interface ShipmentVo {
  id: string
  orderId: string
  carrierCode?: string
  carrierName?: string
  trackingNo?: string
  waybillNo?: string
  status: string
  legType: string
  carrierCost?: number
  sellPrice?: number
  currency?: string
  labelUrl?: string
  legs: ShipmentLegVo[]
  createdAt: string
}

/** 轨迹节点视图对象（§6） */
export interface TrackingVo {
  id: string
  shipmentId: string
  legType?: string
  status: string
  location?: string
  description?: string
  occurredAt: string
}

/** 建单入参 */
export interface BookShipmentInput {
  orderId: string
  carrierCode?: string
  legType?: string
  cargoType?: string
  declaredValue?: number
  currency?: string
}

/** 轨迹上报入参 */
export interface RecordTrackingInput {
  status: string
  location?: string
  description?: string
  occurredAt?: string
}

/** 回传结果 */
export interface FulfillResult {
  success: boolean
  message: string
}

/** 运单状态中文标签（§6 节点映射） */
export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  booked: '已建单',
  pushed: '已回传平台',
  picked_up: '已揽收',
  in_transit: '运输中',
  customs_clearing: '清关中',
  out_for_delivery: '派送中',
  delivered: '已签收',
  exception: '异常',
}

/** 轨迹节点中文标签 */
export const TRACKING_STATUS_LABELS: Record<string, string> = {
  booked: '已建单',
  pushed: '已回传平台',
  picked_up: '已揽收',
  in_transit: '运输中',
  customs_clearing: '清关中',
  out_for_delivery: '派送中',
  delivered: '已签收',
  exception: '异常',
}

/** 物流段中文标签 */
export const LEG_LABELS: Record<string, string> = {
  first: '头程',
  last: '尾程',
  direct: '全程',
}

export const shipmentsApi = {
  /** 为订单建单：向承运商下单并落库运单 + 首条轨迹 */
  book: (input: BookShipmentInput) => http.post<ShipmentVo>('/shipments', input),
  /** 推单回传：将运单号回写销售渠道，推进订单至 pushed */
  fulfill: (id: string) => http.post<FulfillResult>(`/shipments/${id}/fulfill`),
  /** 上报轨迹节点（Webhook/轮询入口） */
  recordTracking: (id: string, input: RecordTrackingInput) =>
    http.post<TrackingVo>(`/shipments/${id}/tracking`, input),
  /** 查询运单轨迹时间线 */
  listTracking: (id: string) => http.get<TrackingVo[]>(`/shipments/${id}/tracking`),
  /** 运单列表（可按订单过滤） */
  list: (orderId?: string) => http.get<ShipmentVo[]>(orderId ? `/shipments?orderId=${orderId}` : '/shipments'),
}
