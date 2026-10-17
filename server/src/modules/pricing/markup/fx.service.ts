/**
 * 币种归一服务（任务 3.6，方案 §10.3）。
 * 承运商可能以 USD/EUR/GBP 等报价，平台结算与商户账单需统一为基准币种（§10.3）。
 * 当前为内存汇率表（日级/小时级刷新，可手动覆盖；待 Redis 缓存 + 外部 FX 源接入，TODO）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { AppLogger } from '../../../common/logger/app.logger'
import { BusinessException } from '../../../common/response/business.exception'
import { FxRateSnapshot } from './markup.types'

/** 平台基准结算币种（§10.3，跨境默认 CNY；可由运营配置，TODO §23 后台） */
export const MARKUP_BASE_CURRENCY = 'CNY'

/**
 * 前端展示所需的若干交叉汇率对（§10.3）。
 * 仅暴露这几个常用对，避免一次性把内部中间态汇率全部吐给前端造成干扰。
 */
const DISPLAY_RATE_PAIRS: Array<{ from: string; to: string }> = [
  { from: 'USD', to: 'CNY' },
  { from: 'EUR', to: 'CNY' },
  { from: 'GBP', to: 'CNY' },
  { from: 'USD', to: 'EUR' },
]

/** 内存汇率种子（from → to → rate，演示口径，TODO 2026-11 接入真实 FX 源） */
const SEED_RATES: Array<{ from: string; to: string; rate: number }> = [
  { from: 'USD', to: 'CNY', rate: 7.2 },
  { from: 'EUR', to: 'CNY', rate: 7.8 },
  { from: 'GBP', to: 'CNY', rate: 9.1 },
  { from: 'CNY', to: 'CNY', rate: 1 },
  { from: 'USD', to: 'USD', rate: 1 },
  { from: 'EUR', to: 'EUR', rate: 1 },
  { from: 'GBP', to: 'GBP', rate: 1 },
  { from: 'CNY', to: 'USD', rate: 1 / 7.2 },
  { from: 'CNY', to: 'EUR', rate: 1 / 7.8 },
  { from: 'CNY', to: 'GBP', rate: 1 / 9.1 },
]

@Injectable()
export class FxService {
  /** 汇率表：from → (to → rate) */
  private readonly rates = new Map<string, Map<string, number>>()

  constructor(private readonly logger: AppLogger) {
    this.seed()
  }

  /** 载入种子汇率（幂等，启动调用一次） */
  private seed(): void {
    for (const r of SEED_RATES) {
      this.setRate(r.from, r.to, r.rate)
    }
    this.logger.debug('[FX] 汇率表已载入种子，基准币种=' + MARKUP_BASE_CURRENCY)
  }

  /** 覆盖/写入一条汇率（运营手动覆盖或外部源刷新，§10.3） */
  setRate(from: string, to: string, rate: number): void {
    const f = from.toUpperCase()
    const t = to.toUpperCase()
    if (!this.rates.has(f)) this.rates.set(f, new Map<string, number>())
    this.rates.get(f)!.set(t, rate)
  }

  /** 取汇率（from → to）；同币返回 1；缺失抛错（诚实失败，避免静默 1:1 误算） */
  getRate(from: string, to: string): number {
    const f = from.toUpperCase()
    const t = to.toUpperCase()
    if (f === t) return 1
    const map = this.rates.get(f)
    const rate = map?.get(t)
    if (rate === undefined) {
      throw new Error(`FX 汇率缺失: ${f}→${t}（待接入真实 FX 源或手动覆盖）`)
    }
    return rate
  }

  /** 将金额从原币归一为基准币种，返回归一后金额 + 汇率快照（§10.3） */
  toBase(amount: number, fromCurrency: string, baseCurrency: string = MARKUP_BASE_CURRENCY): { amount: number; snapshot?: FxRateSnapshot } {
    const rate = this.getRate(fromCurrency, baseCurrency)
    const converted = amount * rate
    if (fromCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
      return { amount: converted }
    }
    return {
      amount: converted,
      snapshot: {
        from: fromCurrency.toUpperCase(),
        to: baseCurrency.toUpperCase(),
        rate,
        effectiveAt: new Date().toISOString(),
      },
    }
  }

  /** 列出展示用汇率对（当前内部汇率表的快照，updatedAt 为读取时刻）。 */
  listRates(): Array<{ base: string; quote: string; rate: number; updatedAt: string }> {
    return DISPLAY_RATE_PAIRS.map((p) => ({
      base: p.from,
      quote: p.to,
      rate: this.getRate(p.from, p.to),
      updatedAt: new Date().toISOString(),
    }))
  }

  /** 手动覆盖某币种对的汇率（运营在「运营配置」页调整，§10.3）。汇率必须为正数。 */
  updateRate(
    from: string,
    to: string,
    rate: number,
  ): { base: string; quote: string; rate: number; updatedAt: string } {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BusinessException('FX_RATE_INVALID', '汇率必须为正数', HttpStatus.BAD_REQUEST)
    }
    this.setRate(from, to, rate)
    this.logger.log(`汇率已覆盖：${from.toUpperCase()}→${to.toUpperCase()} = ${rate}`)
    return {
      base: from.toUpperCase(),
      quote: to.toUpperCase(),
      rate,
      updatedAt: new Date().toISOString(),
    }
  }
}
