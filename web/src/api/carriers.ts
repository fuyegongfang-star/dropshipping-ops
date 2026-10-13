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
  /**
   * 两段式运单编排（§14）：给定头程/尾程承运商与全程参数，后端拆分为两段建单并聚合。
   * 演示模式由 mock-data.ts 返回等价两段结果。
   */
  composeLegs: (req: ComposeLegsRequest) =>
    http.post<ComposeLegsResult>('/carriers/shipments/compose', req),
  /** 面单渲染（§3/§11）：把一段运单渲染为 PDF（pdf-lib）+ ZPL（热敏）双格式 */
  createLabel: (spec: LabelSpec) => http.post<LabelResult>('/carriers/labels', spec),
  /** 报关/合规校验（§19 守卫）：booking 前关卡 */
  validateCustoms: (spec: CustomsSpec) => http.post<CustomsValidationResult>('/carriers/customs/validate', spec),
}

/** 报关/合规校验入参（§19） */
export interface CustomsSpec {
  destCountry: string
  hsCode?: string
  ioss?: string
  eori?: string
  vat?: string
  declaredValue?: number
  currency?: string
  cargoType?: string
  section321?: boolean
}

/** 合规问题（error 阻断 / warning 提示 / info 建议） */
export interface CustomsIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
}

/** 合规校验结果 */
export interface CustomsValidationResult {
  valid: boolean
  issues: CustomsIssue[]
  eligibleSection321: boolean
  recommendedDuty: 'T86' | 'T01' | 'DDP' | 'UNKNOWN'
}

/** 物流段（§14 头程/尾程/全程） */
export type LegType = 'first' | 'last' | 'direct'

/** 单段运单（§14 头程/尾程） */
export interface ShipmentLeg {
  legType: LegType
  carrierCode: string
  carrierName?: string
  waybillNo: string
  trackingNo?: string
  labelUrl?: string
  carrierCost: number
  currency: string
  estimatedLeadDays?: number
  transitHub?: string
}

/** 两段式建单编排请求（前端 → 后端 §14 接口） */
export interface ComposeLegsRequest {
  firstCarrierCode: string // 头程承运商
  lastCarrierCode?: string // 尾程承运商（省略则全程一票到底）
  transitHub?: string // 转运节点 / 海外仓代码
  shipment: {
    orderRef?: string
    origin: string
    destCountry: string
    destZip?: string
    declaredValue?: number
    currency?: string
    parcels: { weightKg: number; lengthCm: number; widthCm: number; heightCm: number }[]
    recipient?: { name: string; country: string; city: string; address1: string }
  }
}

/** 两段式建单编排结果 */
export interface ComposeLegsResult {
  orderRef?: string
  legs: ShipmentLeg[]
  totalCarrierCost: number
  currency: string
  composedAt: string
}

/** 物流段中文标签 */
export const LEG_LABELS: Record<LegType, string> = {
  first: '头程',
  last: '尾程',
  direct: '全程',
}

/** 面单生成入参（§3/§11） */
export interface LabelSpec {
  carrierCode: string
  carrierName?: string
  waybillNo: string
  trackingNo?: string
  recipient?: { name?: string; country?: string; city?: string; address1?: string }
  origin?: string
  destCountry?: string
  weightKg?: number
  legType?: LegType
  transitHub?: string
}

/** 面单生成结果（PDF + ZPL 双格式） */
export interface LabelResult {
  waybillNo: string
  fileName: string
  pdfBase64: string
  zpl: string
  generatedAt: string
}
