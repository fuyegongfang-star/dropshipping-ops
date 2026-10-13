import http from './http'

/**
 * 定价接口封装（阶段3 比价引擎 / 加价规则 / 币种归一，方案 §4/§5/§9/§10）。
 * 对接后端 `POST /pricing/compare`、`GET /pricing/markup-rules`、`GET /pricing/fx`；
 * 演示模式下由 mock-data.ts 返回等价数据。
 */

export type GoodsCategory = 'normal' | 'battery' | 'sensitive'

/** 运费试算请求 */
export interface QuoteRequest {
  country: string
  weightG: number
  lengthCm: number
  widthCm: number
  heightCm: number
  category: GoodsCategory
  declaredValue: number
}

/** 单条报价（成本价 + 加价后售价「双价列」） */
export interface QuoteLine {
  carrierCode: string
  carrierName: string
  productCode: string
  productName: string
  transitDays: string
  costPrice: number
  sellPrice: number
  markupRate: number
  currency: string
  reachable: boolean
  note: string
}

/** 比价引擎四层执行痕迹 */
export interface CompareTrace {
  layer: string
  detail: string
}

export interface CompareResult {
  request: Record<string, unknown>
  chargeableG: number
  currency: string
  lines: QuoteLine[]
  trace: CompareTrace[]
  generatedAt: string
}

/** 加价规则 */
export interface MarkupRule {
  id: string
  scope: 'global' | 'tenant' | 'carrier' | 'channel' | 'product'
  target: string
  mode: 'percent' | 'fixed'
  value: number
  priority: number
  enabled: boolean
  note: string
}

export interface FxRate {
  base: string
  quote: string
  rate: number
  updatedAt: string
}

/** 商品品类中文标签 */
export const CATEGORY_LABELS: Record<GoodsCategory, string> = {
  normal: '普货',
  battery: '带电',
  sensitive: '敏感货',
}

/** 加价作用域中文标签 */
export const SCOPE_LABELS: Record<MarkupRule['scope'], string> = {
  global: '全局',
  tenant: '租户',
  carrier: '承运商',
  channel: '渠道',
  product: '品类',
}

/** 加价规则新增/编辑入参（id 由后端生成，故新建时不含 id）。 */
export type MarkupRuleInput = Omit<MarkupRule, 'id'> & { id?: string }

export const pricingApi = {
  compare: (req: QuoteRequest) => http.post<CompareResult>('/pricing/compare', req),
  markupRules: () => http.get<MarkupRule[]>('/pricing/markup-rules'),
  /** 新建加价规则（自定义加价幅度）。 */
  createMarkupRule: (rule: MarkupRuleInput) => http.post<MarkupRule>('/pricing/markup-rules', rule),
  /** 更新加价规则（含启停、加价幅度调整）。 */
  updateMarkupRule: (id: string, patch: Partial<MarkupRuleInput>) =>
    http.put<MarkupRule>(`/pricing/markup-rules/${id}`, patch),
  /** 删除加价规则。 */
  removeMarkupRule: (id: string) =>
    http.delete<{ deleted: boolean }>(`/pricing/markup-rules/${id}`),
  fxRates: () => http.get<FxRate[]>('/pricing/fx'),
  /** 调整币种汇率。 */
  updateFxRate: (base: string, quote: string, rate: number) =>
    http.put<FxRate>(`/pricing/fx/${base}/${quote}`, { rate }),
}
