/**
 * 轨迹双通道 + NDR 类型（任务 3.11，方案 §3/§6/§20）。
 * 双通道：推送（subscribe/webhook）优先，轮询（getTracking）兜底；NDR 异常事件自动识别。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { CarrierTrackingResult } from '../dto/tracking.dto'

/** 轨迹获取通道 */
export type TrackingChannel = 'push' | 'poll'

/** NDR（Non-Delivery Report / 异常事件）报告 */
export interface NdrReport {
  detected: boolean // 是否检测到异常
  severity: 'info' | 'warning' | 'critical' // 严重级别
  events: string[] // 异常事件描述
  recommendedAction: string // 建议动作（转人工 / 建理赔工单 §20 / 重投）
}

/** 轨迹查询信封：轨迹结果 + 通道 + NDR */
export interface TrackingEnvelope {
  tracking: CarrierTrackingResult
  channel: TrackingChannel // 该承运商采用的通道（推送/轮询）
  subscribed: boolean // 是否成功注册推送订阅（推送通道时）
  ndr: NdrReport
  queriedAt: string
}

/** 轨迹查询入参 */
export interface TrackingQuery {
  carrierCode: string // 承运商代码
  trackingNo: string // 轨迹号
}
