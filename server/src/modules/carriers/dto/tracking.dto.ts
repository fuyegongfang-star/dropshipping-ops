/**
 * 承运商轨迹归一化 DTO（方案 §3 getTracking / §6 轨迹与异常）。
 * 轨迹节点统一存 tracking_events（带 leg 维度，§6）；状态归一化避免被异构字段绑架。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

/** 归一化轨迹状态（对齐 tracking_events.status 枚举语义） */
export enum CarrierTrackingStatus {
  CREATED = 'created', // 已创建
  PICKED_UP = 'picked_up', // 已揽收
  IN_TRANSIT = 'in_transit', // 运输中
  CUSTOMS = 'customs', // 清关中
  OUT_FOR_DELIVERY = 'out_for_delivery', // 派送中
  DELIVERED = 'delivered', // 已签收
  EXCEPTION = 'exception', // 异常（丢件/延误/拒收，§6 NDR）
  CANCELLED = 'cancelled', // 已取消
  UNKNOWN = 'unknown', // 未知
}

/** 轨迹节点 */
export interface CarrierTrackingEvent {
  status: CarrierTrackingStatus // 节点状态（归一化）
  location?: string // 地点
  occurredAt: string // 发生时间（UTC ISO）
  description?: string // 节点描述
}

/** 轨迹查询结果 */
export interface CarrierTrackingResult {
  trackingNo: string // 轨迹号（或运单号）
  carrierCode: string // 承运商代码
  status: CarrierTrackingStatus // 归一化当前状态
  events: CarrierTrackingEvent[] // 轨迹节点列表
}
