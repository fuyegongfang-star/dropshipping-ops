import http from './http'

/**
 * 履约路由接口封装（任务 1.5，方案 §4/§5 模式A 自动选渠道）。
 * 对接后端 `POST /pricing/route`：给定订单发货上下文 + 选渠策略，自动挑最优承运商/产品。
 * 演示模式下由 mock-data.ts 返回等价数据（与比价引擎同口径）。
 */

/** 选渠策略 */
export type RouteStrategy = 'cheapest' | 'fastest'

/** 单箱（与后端 ParcelDto 对齐） */
export interface Parcel {
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
}

/** 履约路由请求 */
export interface RouteRequest {
  destCountry: string
  destZip?: string
  parcels: Parcel[]
  cargoType?: string
  currency?: string
  legType?: string
  servicePreference?: string
  strategy: RouteStrategy
}

/** 归一化报价（与后端 RateQuote 对齐） */
export interface RouteQuote {
  carrierCode: string
  productCode: string
  productName: string
  chargeableWeightKg: number
  currency: string
  carrierCost: number
  sellPrice?: number
  margin?: number
  estimatedLeadDaysMin?: number
  estimatedLeadDaysMax?: number
  reachable: boolean
  note?: string
}

/** 四层执行痕迹 */
export interface RouteLayers {
  l1RateCardHits: number
  l2Reachable: string[]
  l3Queried: string[]
  l3Failed: string[]
  l4Returned: number
}

/** 履约路由推荐结果 */
export interface RouteSuggestion {
  strategy: RouteStrategy
  recommended?: RouteQuote
  alternatives: RouteQuote[]
  rationale: string
  layers: RouteLayers
  generatedAt: string
}

/** 选渠策略中文标签 */
export const STRATEGY_LABELS: Record<RouteStrategy, string> = {
  cheapest: '最省钱',
  fastest: '最快',
}

export const fulfillmentApi = {
  /** 履约路由（模式A 自动选渠道）：返回推荐 + 备选 + 推荐理由 */
  route: (req: RouteRequest) => http.post<RouteSuggestion>('/pricing/route', req),
}
