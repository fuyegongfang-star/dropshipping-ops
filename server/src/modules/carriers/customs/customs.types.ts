/**
 * 报关/合规校验规格（任务 3.10，方案 §19 申报/合规自动化）。
 * 货物在 booking（建单）前须过合规关卡，失败阻断或转人工（§19 守卫）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

/** 合规校验入参（一段运单/包裹的报关要素） */
export interface CustomsSpec {
  destCountry: string // 目的国（ISO2）
  hsCode?: string // HS 编码（6-12 位）
  ioss?: string // 欧盟 IOSS（≤150€ 免 VAT 代缴）
  eori?: string // 欧盟/英国 EORI（清关）
  vat?: string // VAT 号
  declaredValue?: number // 申报价值
  currency?: string // 申报币种（ISO 4217，默认 USD）
  cargoType?: string // 货物类型（general/battery/liquid/sensitive…）
  section321?: boolean // 是否按美国 Section 321（≤$800 T86）申报
}

/** 合规问题（分级：error 阻断 / warning 提示 / info 建议） */
export interface CustomsIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
}

/** 合规校验结果 */
export interface CustomsValidationResult {
  valid: boolean // 是否通过（无 error 即通过，可 booking）
  issues: CustomsIssue[]
  eligibleSection321: boolean // 是否符合美国 Section 321 低值免税（≤$800）
  recommendedDuty: 'T86' | 'T01' | 'DDP' | 'UNKNOWN' // 建议清关方式
}
