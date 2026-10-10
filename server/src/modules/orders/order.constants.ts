/**
 * 订单状态机常量（方案 §13 订单状态机与逆向流程）。
 * 正向状态机 + 逆向类型 + 合法转移表。状态值对齐 Order.status（由 1.1 拉单置 pending_review）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

/** 订单状态（对齐 Order.status 字段，字符串值便于落库与 JSON 传输） */
export enum OrderStatus {
  PENDING_REVIEW = 'pending_review', // 待审
  APPROVED = 'approved', // 已审通过
  REJECTED = 'rejected', // 已驳回
  PUSHED = 'pushed', // 已推单
  PICKED_UP = 'picked_up', // 已揽收
  IN_TRANSIT = 'in_transit', // 运输中
  CUSTOMS_CLEARING = 'customs_clearing', // 清关中
  OUT_FOR_DELIVERY = 'out_for_delivery', // 派送中
  DELIVERED = 'delivered', // 已签收
  COMPLETED = 'completed', // 已完成（终态）
  EXCEPTION = 'exception', // 异常（交叉态，由 NDR/§20 驱动）
  CANCELLED = 'cancelled', // 已撤单（终态）
}

/** 逆向流程类型（§13.2） */
export enum ReverseType {
  CANCEL = 'cancel', // 撤单
  INTERCEPTION = 'interception', // 拦截
  REDIRECT = 'redirect', // 改址
  RETURN = 'return', // 退货退款
}

/**
 * 合法状态转移表（守卫来源，§13.1）。
 * 任意非终态可转入 exception（交叉态）；rejected 允许退回 pending_review 重新审核。
 * 终态 completed / cancelled 不再转移（rejected 非终态，可重审）。
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_REVIEW]: [OrderStatus.APPROVED, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  [OrderStatus.APPROVED]: [OrderStatus.PUSHED, OrderStatus.CANCELLED],
  [OrderStatus.REJECTED]: [OrderStatus.PENDING_REVIEW],
  [OrderStatus.PUSHED]: [OrderStatus.PICKED_UP, OrderStatus.EXCEPTION, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT, OrderStatus.EXCEPTION],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.CUSTOMS_CLEARING, OrderStatus.EXCEPTION],
  [OrderStatus.CUSTOMS_CLEARING]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.EXCEPTION],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.EXCEPTION],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.EXCEPTION],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.EXCEPTION]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.CANCELLED]: [],
}

/** 终态集合（不可再转移） */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
])
