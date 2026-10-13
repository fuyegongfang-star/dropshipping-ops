import http from './http'

/**
 * 承运商接口封装（阶段3 承运商适配器，方案 §3）。
 * 对接后端 `GET /carriers` 与 `GET /carriers/:code/health`；
 * 演示模式下由 mock-data.ts 返回等价数据。
 */

/** 六能力矩阵：比价 / 建单 / 面单 / 轨迹 / 取消 / 订阅 */
export interface CarrierCapability {
  rate: boolean
  ship: boolean
  label: boolean
  track: boolean
  cancel: boolean
  subscribe: boolean
}

export interface CarrierHealth {
  status: 'up' | 'degraded' | 'down'
  latencyMs: number
  uptime: number
  checkedAt: string
  note: string
}

export interface Carrier {
  code: string
  name: string
  enName: string
  authType: string
  sandbox: boolean
  region: string
  capabilities: CarrierCapability
  health: CarrierHealth
  note: string
}

/** 能力矩阵前端展示顺序与中文标签 */
export const CAPABILITY_LABELS: { key: keyof CarrierCapability; label: string }[] = [
  { key: 'rate', label: '比价' },
  { key: 'ship', label: '建单' },
  { key: 'label', label: '面单' },
  { key: 'track', label: '轨迹' },
  { key: 'cancel', label: '取消' },
  { key: 'subscribe', label: '订阅' },
]

export const carriersApi = {
  list: () => http.get<Carrier[]>('/carriers'),
  health: (code: string) => http.get<CarrierHealth>(`/carriers/${code}/health`),
}
