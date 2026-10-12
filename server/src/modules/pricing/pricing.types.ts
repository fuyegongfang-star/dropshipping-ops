/**
 * 比价引擎归一化类型（任务 3.5，方案 §5 比价/智能路由引擎）。
 * 比价引擎复用承运商适配器六能力的 getRates，叠加 4 层（L1 费率卡 → L2 可达性 →
 * L3 实时池 → L4 护栏），并以「试算模式开关」区分代运营锁价与商户自助多选（§4.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { CargoType, LegType, ParcelDto } from '../carriers/dto/rate.dto'
import { RateQuote } from '../carriers/dto/rate.dto'

/** 比价/试算入参（§4.1 / §5） */
export interface CompareRequest {
  destCountry: string // 目的国（ISO2）
  destZip?: string // 目的邮编（分区与可达性，§18）
  parcels: ParcelDto[] // 包裹列表（≥1，多箱 Σ 计费重，§4.2）
  cargoType?: CargoType // 货物类型（默认普货，§4.3）
  currency?: string // 申报币种（ISO 4217）
  legType?: LegType // 物流段（默认全程）
  servicePreference?: string // 时效优先/价格优先/指定渠道（§4.3）
  trial?: boolean // 试算模式（§4.1）：返回多结果列表，不锁价
}

/** 比价结果（4 层执行痕迹 + 报价/锁价） */
export interface CompareResult {
  trial: boolean // 是否试算模式（§4.1）
  quotes: RateQuote[] // 护栏后报价列表（已去重/排序/截断）
  selected?: RateQuote // 非试算模式锁定的最优报价（§5 L4 诚实护栏）
  layers: {
    l1RateCardHits: number // L1 预热费率卡命中数（§5）
    l2Reachable: string[] // L2 通过可达性的承运商
    l3Queried: string[] // L3 实际发起实时询价的承运商
    l3Failed: string[] // L3 实时询价失败的承运商（捕获不中断）
    l4Returned: number // L4 护栏后返回条数
  }
  generatedAt: string // 生成时间（UTC ISO）
}
