/**
 * 币种归一服务（任务 3.6，方案 §10.3；任务 11.2 持久化到 fx_rates 表）。
 *
 * 设计（11.2）：
 * - **DB 为源、内存为热路径缓存**：fx_rates 表是唯一真相源；服务启动时把全表载入内存 Map，
 *   运行期 getRate/toBase/listRates 全部走内存（热路径零 await，比价引擎不受影响）；
 * - **优雅降级**：若 PostgreSQL 暂不可达（如沙箱无 PG），onModuleInit 捕获异常并保留构造函数内
 *   的种子，保证服务可独立启动；运营手动覆盖(updateRate)在 DB 不可达时仅更新内存并告警。
 * - 运营手动覆盖（PUT /pricing/fx）写库 + 更新缓存，重启后依然生效，关闭 §3 待办（内存汇率易失）。
 *
 * 负责人：夜间自动开发引擎 ｜ 新增 DB 持久化于 2026-11-04 夜间批次（11.2）
 */

import { Injectable, OnModuleInit } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { AppLogger } from '../../../common/logger/app.logger'
import { BusinessException } from '../../../common/response/business.exception'
import { PrismaService } from '../../../database/prisma.service'
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

/** 内存汇率种子（from → to → rate，演示口径；DB 空时落库，TODO 2026-11 接入真实 FX 源） */
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
export class FxService implements OnModuleInit {
  /** 汇率表：from → (to → rate)，热路径缓存 */
  private readonly rates = new Map<string, Map<string, number>>()

  constructor(
    private readonly logger: AppLogger,
    private readonly prisma: PrismaService,
  ) {
    // 构造函数内仍先灌入内存种子：即便 DB 不可达，服务也能独立提供默认汇率（优雅降级）
    this.seedMemory()
  }

  /** 服务启动时：从 fx_rates 载入内存缓存；若表为空则落库种子（幂等）。DB 不可达则保留内存种子。 */
  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.prisma.fxRate.findMany()
      if (rows.length === 0) {
        await this.seedToDb()
        this.logger.log('[FX] fx_rates 表为空，已落库种子汇率')
      } else {
        for (const r of rows) {
          this.setRate(r.from, r.to, Number(r.rate))
        }
        this.logger.log(`[FX] 已从 fx_rates 载入 ${rows.length} 条汇率到内存缓存`)
      }
    } catch (err) {
      // PostgreSQL 未就绪时不应阻断启动；保留构造函数种子，运营覆盖仅在内存生效
      this.logger.warn(`[FX] 从 fx_rates 载入失败，使用内存种子（${this.describe(err)}）`)
    }
  }

  /** 载入种子汇率到内存（幂等，启动调用一次） */
  private seedMemory(): void {
    for (const r of SEED_RATES) {
      this.setRate(r.from, r.to, r.rate)
    }
    this.logger.debug('[FX] 内存汇率种子已载入，基准币种=' + MARKUP_BASE_CURRENCY)
  }

  /** 种子落库：逐条 upsert（from+to 维度幂等覆盖） */
  private async seedToDb(): Promise<void> {
    for (const r of SEED_RATES) {
      await this.prisma.fxRate.upsert({
        where: { from_to: { from: r.from.toUpperCase(), to: r.to.toUpperCase() } },
        create: {
          from: r.from.toUpperCase(),
          to: r.to.toUpperCase(),
          rate: new Prisma.Decimal(r.rate),
          source: 'seed',
        },
        update: { rate: new Prisma.Decimal(r.rate), source: 'seed' },
      })
    }
  }

  /** 覆盖/写入一条汇率（内存；种子与回写共用） */
  private setRate(from: string, to: string, rate: number): void {
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
  toBase(
    amount: number,
    fromCurrency: string,
    baseCurrency: string = MARKUP_BASE_CURRENCY,
  ): { amount: number; snapshot?: FxRateSnapshot } {
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

  /** 手动覆盖某币种对的汇率（运营在「运营配置」页调整，§10.3）。汇率必须为正数。落库 + 更新缓存。 */
  async updateRate(
    from: string,
    to: string,
    rate: number,
  ): Promise<{ base: string; quote: string; rate: number; updatedAt: string }> {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BusinessException('FX_RATE_INVALID', '汇率必须为正数', 400)
    }
    const f = from.toUpperCase()
    const t = to.toUpperCase()
    this.setRate(f, t, rate) // 先更新缓存，保证热路径立即生效
    try {
      await this.prisma.fxRate.upsert({
        where: { from_to: { from: f, to: t } },
        create: { from: f, to: t, rate: new Prisma.Decimal(rate), source: 'manual' },
        update: { rate: new Prisma.Decimal(rate), source: 'manual' },
      })
      this.logger.log(`[FX] 汇率已覆盖并落库：${f}→${t} = ${rate}`)
    } catch (err) {
      this.logger.warn(`[FX] 汇率内存已更新但落库失败（${this.describe(err)}），重启将丢失`)
    }
    return { base: f, quote: t, rate, updatedAt: new Date().toISOString() }
  }

  /** 截断错误描述，避免敏感堆栈外泄到日志 */
  private describe(err: unknown): string {
    return err instanceof Error ? err.message : String(err)
  }
}
