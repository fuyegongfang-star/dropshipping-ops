/**
 * 履约路由（模式A 自动选渠道，任务 1.5，方案 §4/§5）。
 *
 * 业务含义：代运营/自动履约场景下，系统依据订单的发货上下文（目的国/包裹/货物类型）
 * 自动从比价引擎结果中挑选最优承运商与物流产品，无需人工逐家比价。
 * 策略：
 *   - cheapest（最省钱）：加价后售价 sell_price 最低（缺则回退 carrier_cost）。
 *   - fastest（最快）：预计时效 estimatedLeadDaysMin 最小。
 * 诚实原则（与 §5 L4 一致）：仅从「可达 + 护栏后」报价中挑选，无可行渠道时推荐为空并说明。
 *
 * 实现上复用成熟的比价引擎（3.5 四层 + §10 加价层），本服务只做「策略选优 + 推荐解释」，
 * 不重复询价逻辑，避免口径漂移。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../common/logger/app.logger'
import { CargoType, LegType, ParcelDto } from '../carriers/dto/rate.dto'
import { RateQuote } from '../carriers/dto/rate.dto'
import { PricingEngineService } from './pricing-engine.service'

/** 自动路由策略（§4.3 时效优先/价格优先的自动化形态） */
export enum RouteStrategy {
  CHEAPEST = 'cheapest',
  FASTEST = 'fastest',
}

/** 履约路由入参（订单发货上下文 + 选渠策略） */
export interface RouteRequest {
  destCountry: string // 目的国（ISO2）
  destZip?: string // 目的邮编
  parcels: ParcelDto[] // 包裹列表（≥1）
  cargoType?: CargoType // 货物类型
  currency?: string // 申报币种
  legType?: LegType // 物流段
  servicePreference?: string // 时效优先/价格优先/指定渠道
  strategy: RouteStrategy // 选渠策略
}

/** 履约路由推荐结果 */
export interface RouteSuggestion {
  strategy: RouteStrategy
  recommended?: RateQuote // 自动选中的最优渠道（无可行渠道时为 undefined）
  alternatives: RateQuote[] // 次优备选（按策略排序，剔除推荐项）
  rationale: string // 推荐理由（人类可读，便于运营核对）
  layers: {
    l1RateCardHits: number
    l2Reachable: string[]
    l3Queried: string[]
    l3Failed: string[]
    l4Returned: number
  }
  generatedAt: string
}

@Injectable()
export class FulfillmentRouterService {
  constructor(
    private readonly engine: PricingEngineService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * 自动选渠道（模式A）：复用比价引擎拿护栏后报价（trial 模式不锁价），再按策略挑选最优。
   * 返回推荐项 + 备选列表 + 推荐理由，供履约工作台一键采纳或人工复核。
   */
  async route(tenantId: string, req: RouteRequest): Promise<RouteSuggestion> {
    const result = await this.engine.compare(tenantId, {
      destCountry: req.destCountry,
      destZip: req.destZip,
      parcels: req.parcels,
      cargoType: req.cargoType,
      currency: req.currency,
      legType: req.legType,
      servicePreference: req.servicePreference,
      trial: true, // 路由层自己做策略选优，不依赖引擎 selected 锁价
    })

    const ranked = this.rank(result.quotes, req.strategy)
    const recommended = ranked[0]
    const alternatives = ranked.slice(1, 4) // 取次优 3 条作为备选

    return {
      strategy: req.strategy,
      recommended,
      alternatives,
      rationale: this.buildRationale(req.strategy, recommended, result.quotes.length),
      layers: result.layers,
      generatedAt: result.generatedAt,
    }
  }

  /** 按策略排序：cheapest 看售价/成本；fastest 看时效下限（缺失排末尾） */
  private rank(quotes: RateQuote[], strategy: RouteStrategy): RateQuote[] {
    const sorted = [...quotes]
    if (strategy === RouteStrategy.FASTEST) {
      sorted.sort((a, b) => this.leadDays(a) - this.leadDays(b))
    } else {
      sorted.sort((a, b) => this.priceOf(a) - this.priceOf(b))
    }
    return sorted
  }

  /** 报价生效价（售价优先，缺失回退成本） */
  private priceOf(q: RateQuote): number {
    return q.sellPrice ?? q.carrierCost
  }

  /** 时效下限（缺失视为极大值，排末尾） */
  private leadDays(q: RateQuote): number {
    return q.estimatedLeadDaysMin ?? q.estimatedLeadDaysMax ?? Number.MAX_SAFE_INTEGER
  }

  /** 生成可读推荐理由（便于运营核对选渠逻辑） */
  private buildRationale(strategy: RouteStrategy, rec: RateQuote | undefined, poolSize: number): string {
    if (!rec) {
      return `未找到可达渠道（候选 ${poolSize} 条经可达性/护栏过滤后无可用项），请检查目的国/货物类型或手动指定渠道。`
    }
    const label = strategy === RouteStrategy.FASTEST ? '时效优先' : '价格优先'
    const price = rec.sellPrice != null ? `¥${rec.sellPrice.toFixed(2)}` : `成本 ¥${rec.carrierCost.toFixed(2)}`
    const lead =
      rec.estimatedLeadDaysMin != null
        ? `${rec.estimatedLeadDaysMin}-${rec.estimatedLeadDaysMax ?? rec.estimatedLeadDaysMin} 工作日`
        : '时效未知'
    this.logger.debug(`[Route] ${label} 推荐 ${rec.productName}（${price} / ${lead}）`)
    return `基于「${label}」策略，自动推荐 ${rec.productName}（${price}，${lead}），从 ${poolSize} 条候选中胜出。`
  }
}
