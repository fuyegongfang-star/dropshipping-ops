/**
 * 试算单（quote）类型（任务 3.7，方案 §4 运费试算门户 / §4.6 试算→订单联动）。
 * 试算结果带 quote_id（完整输入快照 + 计算结果 + 有效期），商户可锁定带入下单，
 * 保证「试算看到的 ≈ 下单付的」（§4.6 / §10 报价即实收）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { CompareRequest } from '../pricing.types'
import { RateQuote } from '../../carriers/dto/rate.dto'

/** 试算单状态（§4.6） */
export enum QuoteStatus {
  ACTIVE = 'active', // 有效（未过期、未使用）
  EXPIRED = 'expired', // 已过期（需重新试算）
  USED = 'used', // 已带入下单（锁价消费）
  CANCELLED = 'cancelled', // 已取消
}

/** 试算单（内存模型；待 §7/§10.6 落 `quotes` 表持久化） */
export interface Quote {
  id: string // quote_id（UUID）
  tenantId: string // 租户（隔离，§0/§17）
  inputSnapshot: CompareRequest // 完整输入快照（目的国/包裹/货物类型…，保证可复现与锁价）
  results: RateQuote[] // 试算报价列表（已加价、双价列，§4.3/§10）
  selectedProductCode?: string // 商户自选产品（渠道自选，§4.0 模式B）
  currency: string // 报价币种（基准币种，§10.3）
  status: QuoteStatus // 状态
  expiresAt: string // 有效期（UTC ISO，§4.6）
  createdAt: string // 创建时间（UTC ISO）
}

/** 试算单默认有效期：24h（§4.6；TODO 运营可配 30min/24h，§23） */
export const QUOTE_TTL_MS = 24 * 60 * 60 * 1000
