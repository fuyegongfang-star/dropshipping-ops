/**
 * 聚合平台兜底追踪规格（任务 3.13，方案 §3e 聚合平台兜底）。
 *
 * 职责：当承运商直连轨迹失败 / 尾程多承运商分散时，经 AfterShip / 17TRACK 等聚合平台
 * 统一拉取并归一化尾程轨迹，作为直连追踪的兜底通道（与 §6 双通道互补）。
 *
 * 说明：聚合平台 API Key / 端点为合理占位（TODO 2026-11 联调校正）；不支持的聚合平台一律诚实抛 NOT_IMPLEMENTED。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

/** 聚合追踪查询入参 */
export interface AggregatorQuery {
  aggregatorCode: string // 聚合平台代码（aftership / 17track）
  carrierCode: string // 承运商代码（尾程承运商）
  trackingNo: string // 运单 / 轨迹号
}

/** 归一化轨迹节点（与 §3 getTracking 同构，便于上层统一消费） */
export interface AggregatorEvent {
  status: string
  location?: string
  occurredAt: string
  description?: string
}

/** 聚合追踪结果 */
export interface AggregatorResult {
  trackingNo: string
  carrierCode: string
  aggregatorCode: string
  aggregatorName: string
  status: string // 归一化状态（normalized）
  events: AggregatorEvent[]
  fallback: boolean // true=聚合平台未能解析，需承运商直连兜底（§3e）
  note: string
}

/** 已接入的聚合平台目录项 */
export interface AggregatorCatalogItem {
  code: string
  name: string
  capability: 'track' // 当前仅轨迹聚合兜底
}
