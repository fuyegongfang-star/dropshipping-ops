/**
 * 比价 / 智能路由引擎（任务 3.5，方案 §5 分层架构 + §4.1 试算模式）。
 * 4 层：
 *   L1 预热费率卡缓存（Redis，合约价；当前接口预留，返回空，TODO §5）
 *   L2 可达性地图（ReachabilityService，<5ms 剔除不可达，§5）
 *   L3 实时调用池（有界并行，适配器 2s 超时即 SLA；失败捕获不中断，§5）
 *   L4 诚实护栏（去重+排序+截断；非试算模式锁价 selected，试算模式返回多列表，§5/§4.1）
 * 加价层（§10）在 3.6 接入；本引擎只产出 carrierCost，sell_price 由 3.6 填充。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Injectable } from '@nestjs/common'
import { AppLogger } from '../../common/logger/app.logger'
import { CarrierCode } from '../carriers/carrier.constants'
import { CarrierAdapter } from '../carriers/carrier-adapter.interface'
import { CarrierRegistryService } from '../carriers/carrier-registry.service'
import { CarriersService } from '../carriers/carriers.service'
import { GetRatesRequest, RateQuote } from '../carriers/dto/rate.dto'
import { CompareRequest, CompareResult } from './pricing.types'
import { ReachabilityService } from './reachability.service'
import { MarkupEngineService } from './markup/markup-engine.service'
import { MARKUP_BASE_CURRENCY } from './markup/fx.service'

/** 护栏最多返回条数（避免前端过载，§5 L4） */
export const PRICING_MAX_RESULTS = 20

@Injectable()
export class PricingEngineService {
  constructor(
    private readonly registry: CarrierRegistryService,
    private readonly carriers: CarriersService,
    private readonly reachability: ReachabilityService,
    private readonly markup: MarkupEngineService,
    private readonly logger: AppLogger,
  ) {}

  /** 平台基准结算币种（§10.3，币种归一目标） */
  private readonly baseCurrency = MARKUP_BASE_CURRENCY

  /**
   * 比价/试算主入口（§5 四层 + §4.1 试算开关）。
   * @param tenantId 租户 ID（工厂型承运商按租户账号解析，§2.2）
   * @param req 比价/试算入参
   */
  async compare(tenantId: string, req: CompareRequest): Promise<CompareResult> {
    // L1 预热费率卡（当前无合约价卡数据，返回空；真实价走 L3，TODO Redis/rate card，§5）
    const l1 = await this.rateCardQuotes(req)

    // L2 可达性地图：逐承运商过滤不可达，减少无效实时调用（§5）
    const codes = this.registry.listCodes()
    const l2Reachable: string[] = []
    for (const code of codes) {
      const r = this.reachability.isReachable(code, req.destCountry, req.cargoType)
      if (r.reachable) l2Reachable.push(code)
      else this.logger.debug(`[Pricing] L2 不可达 ${code}: ${r.reason}`)
    }

    // L3 实时调用池：有界并行（Promise.all），适配器 2s 超时即 SLA；失败捕获不中断（§5）
    const l3Queried: string[] = []
    const l3Failed: string[] = []
    const tasks = l2Reachable.map(async (code) => {
      try {
        const adapter: CarrierAdapter = await this.carriers.resolveAdapter(tenantId, code as CarrierCode)
        const quotes = await adapter.getRates(this.toGetRatesRequest(req))
        l3Queried.push(code)
        return quotes
      } catch (e) {
        l3Failed.push(code)
        this.logger.warn(`[Pricing] L3 ${code} 询价失败: ${(e as Error).message}`)
        return [] as RateQuote[]
      }
    })
    const merged: RateQuote[] = (await Promise.all(tasks)).flat()

    // L4 诚实护栏：去重 + 排序 + 截断；非试算模式锁价 selected（§5）
    const guarded = this.guardrail(merged)
    // 加价层（§10）：L4 之后、返回商户前，币种归一 + 加价 → 双价列 sell_price/margin
    const enriched = this.markup.enrichQuotes(tenantId, guarded, this.baseCurrency)
    const selected = req.trial ? undefined : this.pickBest(enriched)

    return {
      trial: req.trial ?? false,
      quotes: enriched,
      selected,
      layers: {
        l1RateCardHits: l1.length,
        l2Reachable,
        l3Queried,
        l3Failed,
        l4Returned: guarded.length,
      },
      generatedAt: new Date().toISOString(),
    }
  }

  /** L1 预热费率卡（§5；当前接口预留，待 Redis/rate card 落地） */
  private async rateCardQuotes(req: CompareRequest): Promise<RateQuote[]> {
    // TODO(ops): 2026-11 接入 L1 预热费率卡（Redis，按 origin/dest/weight slab/leg_type 索引，§5）；
    // 当前无合约价卡数据，返回空（真实价走 L3 实时池）。
    void req
    return []
  }

  /** CompareRequest → 承运商 getRates 归一化入参（复用 §3 DTO） */
  private toGetRatesRequest(req: CompareRequest): GetRatesRequest {
    return {
      destCountry: req.destCountry,
      destZip: req.destZip,
      parcels: req.parcels,
      cargoType: req.cargoType,
      currency: req.currency,
      legType: req.legType,
      servicePreference: req.servicePreference,
    }
  }

  /** L4 护栏：去重（同承运商同产品）→ 可达性过滤 → 成本升序 → 截断（§5） */
  private guardrail(quotes: RateQuote[]): RateQuote[] {
    const seen = new Set<string>()
    const dedup = quotes.filter((q) => {
      const key = `${q.carrierCode}:${q.productCode}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const reachable = dedup.filter((q) => q.reachable)
    reachable.sort((a, b) => a.carrierCost - b.carrierCost)
    return reachable.slice(0, PRICING_MAX_RESULTS)
  }

  /** 锁定最优（商户售价最低）报价（§5 L4 诚实护栏；报价即实收，平台吸收成本波动，§5/§9/§10） */
  private pickBest(quotes: RateQuote[]): RateQuote | undefined {
    if (quotes.length === 0) return undefined
    // 优先按加价后售价 sell_price 选最低（锁价给商户），缺失时回退 carrier_cost
    return quotes.reduce((best, q) => {
      const bestPrice = best.sellPrice ?? best.carrierCost
      const qPrice = q.sellPrice ?? q.carrierCost
      return qPrice < bestPrice ? q : best
    })
  }
}
