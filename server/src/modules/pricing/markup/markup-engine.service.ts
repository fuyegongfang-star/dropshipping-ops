/**
 * 加价引擎（任务 3.6，方案 §10 双价列 / 加价层 / 币种归一）。
 * 在比价引擎 L4 之后、返回商户前（§5）执行：
 *   1) 币种归一：carrier_cost（原币）经 FxService 转基准币种（§10.3）；
 *   2) 加价叠加：按上下文适用规则逐条变换（PERCENT/FIXED/TIERED），MIN_MARGIN 兜底（§10.2）；
 *   3) 双价列产出：sell_price（商户可见）+ carrier_cost（基准，用于对账）+ margin（利润）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../../common/logger/app.logger'
import { RateQuote } from '../../carriers/dto/rate.dto'
import { FxService, MARKUP_BASE_CURRENCY } from './fx.service'
import { MarkupRulesService } from './markup-rules.service'
import { MarkupContext, MarkupResult, MarkupRule } from './markup.types'

/** 货币金额保留 2 位小数（分），避免浮点误差 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

@Injectable()
export class MarkupEngineService {
  constructor(
    private readonly fx: FxService,
    private readonly rules: MarkupRulesService,
    private readonly logger: AppLogger,
  ) {}

  /** 按计费重匹配阶梯 rate（命中段取 rate；未命中取 defaultRate，再无则 0） */
  private pickTierRate(rule: MarkupRule, weightKg?: number): number {
    const tiers = rule.params.tiers
    if (!tiers || tiers.length === 0) return rule.params.defaultRate ?? 0
    const w = weightKg ?? 0
    for (const t of tiers) {
      const min = t.minWeightKg ?? 0
      const max = t.maxWeightKg ?? Number.MAX_SAFE_INTEGER
      if (w >= min && w < max) return t.rate
    }
    return rule.params.defaultRate ?? 0
  }

  /** 对单条报价执行币种归一 + 加价，产出双价列（§10.1） */
  apply(tenantId: string, quote: RateQuote, baseCurrency: string = MARKUP_BASE_CURRENCY): MarkupResult {
    const fromCurrency = quote.currency || baseCurrency
    const { amount: carrierCostBase, snapshot } = this.fx.toBase(quote.carrierCost, fromCurrency, baseCurrency)

    const ctx: MarkupContext = {
      tenantId,
      carrierCode: quote.carrierCode,
      productCode: quote.productCode,
      destCountry: undefined, // 待 §18 zone_maps；当前规则不依赖分区
      cargoType: undefined,
      chargeableWeightKg: quote.chargeableWeightKg,
    }

    const applicable = this.rules.resolveRules(ctx)
    let price = carrierCostBase
    const applied: string[] = []

    // 1) 顺序应用 PERCENT / FIXED / TIERED
    for (const r of applicable) {
      if (r.ruleType === 'min_margin') continue // 兜底最后处理
      const label = `${r.scope}:${r.ruleType}#${r.id}`
      switch (r.ruleType) {
        case 'percent': {
          const rate = r.params.rate ?? 0
          price = price * (1 + rate)
          applied.push(`${label}(×${(1 + rate).toFixed(3)})`)
          break
        }
        case 'fixed': {
          const amt = r.params.amount ?? 0
          price = price + amt
          applied.push(`${label}(+${amt})`)
          break
        }
        case 'tiered': {
          const rate = this.pickTierRate(r, ctx.chargeableWeightKg)
          price = price * (1 + rate)
          applied.push(`${label}(×${(1 + rate).toFixed(3)})`)
          break
        }
        default:
          break
      }
    }

    // 2) MIN_MARGIN 最低毛利保护（§10.2）：margin < 下限时抬高到下限
    for (const r of applicable) {
      if (r.ruleType !== 'min_margin') continue
      const floor = r.params.minAmount ?? 0
      if (price - carrierCostBase < floor) {
        price = carrierCostBase + floor
        applied.push(`min_margin#${r.id}(floor=${floor})`)
      }
    }

    const margin = price - carrierCostBase
    const marginPct = price > 0 ? margin / price : 0
    this.logger.debug(
      `[Markup] ${quote.carrierCode}/${quote.productCode} costBase=${carrierCostBase.toFixed(2)} sell=${price.toFixed(2)} margin=${margin.toFixed(2)}`,
    )

    return {
      carrierCostBase: round2(carrierCostBase),
      sellPrice: round2(price),
      margin: round2(margin),
      marginPct: Math.round(marginPct * 10000) / 10000,
      baseCurrency,
      fxRate: snapshot,
      appliedRules: applied,
    }
  }

  /** 批量将报价列表归一加价，回填 RateQuote 双价列（供比价引擎 L4 后调用） */
  enrichQuotes(tenantId: string, quotes: RateQuote[], baseCurrency: string = MARKUP_BASE_CURRENCY): RateQuote[] {
    return quotes.map((q) => {
      const r = this.apply(tenantId, q, baseCurrency)
      return {
        ...q,
        carrierCost: r.carrierCostBase,
        sellPrice: r.sellPrice,
        margin: r.margin,
        currency: r.baseCurrency,
        fxRateSnapshot: r.fxRate,
      }
    })
  }
}
