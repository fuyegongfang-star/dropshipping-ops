/**
 * 商户账单与承运商对账服务（任务 4.2，方案 §9/§10/§16.4）。
 *
 * 聚合逻辑：
 * - 商户账单：按账期聚合各租户 Shipment.sellPrice → Bill（tenant + period 唯一）。
 * - 承运商对账：按账期聚合各承运商 Shipment.carrierCost → Reconciliation（carrierCode + period 唯一）。
 * - 利润核算：平台利润 = Σ totalSell − Σ totalCost（§9 spread）。
 *
 * 状态机：
 * - Bill：draft（生成/重算）→ issued（出账）→ settled（结清）。
 * - Reconciliation：open（生成）→ matched（匹配）→ closed（关闭）。
 *
 * 租户隔离：账单按 tenantId 隔离（§0/§17）；承运商对账与利润核算为平台级（跨租户聚合）。
 * 币种按平台基准币 CNY 聚合（§10 FX 跨币折算待接入）。
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Injectable, HttpStatus, Inject } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { TENANT_PRISMA, TenantPrismaClient } from '../../common/tenant/tenant-prisma.service'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import { BillItem, ReconciliationItem, ProfitSummary, GenerateResult, ProfitBreakdown, TenantProfit, CarrierCost } from './billing.types'

const DEFAULT_CURRENCY = 'CNY'

@Injectable()
export class BillingService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrismaClient,
    private readonly logger: AppLogger,
  ) {}

  // ---- 账期工具 ----------------------------------------------------------

  /**
   * 将 "YYYY-MM" 解析为 UTC 左闭右开的月份区间。
   * 例：2026-10 → [2026-10-01T00:00:00Z, 2026-11-01T00:00:00Z)
   */
  private periodRange(period: string): { gte: Date; lt: Date } {
    const m = /^(\d{4})-(\d{2})$/.exec(period)
    if (!m) {
      throw new BusinessException('BILL_PERIOD_INVALID', `账期格式应为 YYYY-MM，收到：${period}`, HttpStatus.BAD_REQUEST)
    }
    const year = Number(m[1])
    const month = Number(m[2])
    if (month < 1 || month > 12) {
      throw new BusinessException('BILL_PERIOD_INVALID', `月份越界：${period}`, HttpStatus.BAD_REQUEST)
    }
    return {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    }
  }

  // ---- 商户账单（按租户 + 账期聚合 sell_price） ----------------------------

  /**
   * 生成商户账单：按账期聚合各租户 Shipment.sellPrice。
   * tenantId 省略时对所有租户出账（平台级操作）。
   * 成本待回传（carrierCost=null）的运单暂不计入财务聚合（§9 C1）：成本未知即无法确认利润，
   * 延迟到费用回传后再入账，避免「已售却无成本」系统性高估利润。
   */
  async generateBills(period: string, tenantId?: string): Promise<GenerateResult> {
    const { gte, lt } = this.periodRange(period)
    const where: Prisma.ShipmentWhereInput = {
      createdAt: { gte, lt },
      sellPrice: { not: null },
      carrierCost: { not: null },
    }
    if (tenantId) where.tenantId = tenantId

    const groups = await this.prisma.shipment.groupBy({
      by: ['tenantId'],
      where,
      _sum: { sellPrice: true },
      _count: { _all: true },
    })

    let generated = 0
    let updated = 0
    for (const g of groups) {
      const totalSell = new Prisma.Decimal(g._sum.sellPrice ?? 0)
      const itemCount = g._count._all
      const existing = await this.prisma.bill.findUnique({
        where: { tenantId_period: { tenantId: g.tenantId, period } },
      })
      if (existing) {
        await this.prisma.bill.update({
          where: { id: existing.id },
          data: { totalSell, itemCount, currency: DEFAULT_CURRENCY },
        })
        updated++
      } else {
        await this.prisma.bill.create({
          data: { tenantId: g.tenantId, period, currency: DEFAULT_CURRENCY, totalSell, itemCount, status: 'draft' },
        })
        generated++
      }
    }
    this.logger.log(`[Billing] 生成商户账单 period=${period} tenant=${tenantId ?? 'ALL'} generated=${generated} updated=${updated}`)
    return { period, generated, updated }
  }

  /** 商户账单列表（按租户隔离，§0/§17） */
  async listBills(tenantId: string, status?: string): Promise<BillItem[]> {
    const rows = await this.prisma.bill.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { period: 'desc' },
    })
    return rows.map(mapBill)
  }

  async getBill(id: string): Promise<BillItem> {
    const b = await this.prisma.bill.findUnique({ where: { id } })
    if (!b) throw new BusinessException('BILL_NOT_FOUND', `账单不存在：${id}`, HttpStatus.NOT_FOUND)
    return mapBill(b)
  }

  /** 出账：draft → issued */
  async issueBill(id: string): Promise<BillItem> {
    const b = await this.prisma.bill.findUnique({ where: { id } })
    if (!b) throw new BusinessException('BILL_NOT_FOUND', `账单不存在：${id}`, HttpStatus.NOT_FOUND)
    if (b.status !== 'draft') {
      throw new BusinessException('BILL_STATE_INVALID', `仅草稿可出账，当前状态：${b.status}`, HttpStatus.BAD_REQUEST)
    }
    const u = await this.prisma.bill.update({ where: { id }, data: { status: 'issued' } })
    this.logger.log(`[Billing] 出账 bill=${id} period=${b.period} tenant=${b.tenantId}`)
    return mapBill(u)
  }

  /** 结清：issued → settled */
  async settleBill(id: string): Promise<BillItem> {
    const b = await this.prisma.bill.findUnique({ where: { id } })
    if (!b) throw new BusinessException('BILL_NOT_FOUND', `账单不存在：${id}`, HttpStatus.NOT_FOUND)
    if (b.status !== 'issued') {
      throw new BusinessException('BILL_STATE_INVALID', `仅已出账可结清，当前状态：${b.status}`, HttpStatus.BAD_REQUEST)
    }
    const u = await this.prisma.bill.update({ where: { id }, data: { status: 'settled' } })
    this.logger.log(`[Billing] 结清 bill=${id} tenant=${b.tenantId}`)
    return mapBill(u)
  }

  // ---- 承运商对账（按承运商 + 账期聚合 carrier_cost） ----------------------

  /**
   * 生成承运商对账：按账期聚合各承运商 Shipment.carrierCost。
   * carrierId → carrierCode 经 Carrier 表映射（§3 承运商编码）。
   */
  async generateReconciliations(period: string): Promise<GenerateResult> {
    const { gte, lt } = this.periodRange(period)
    const carriers = await this.prisma.carrier.findMany({ select: { id: true, code: true } })
    const carrierCodeById = new Map(carriers.map((c) => [c.id, c.code]))

    const groups = await this.prisma.shipment.groupBy({
      by: ['carrierId'],
      where: { createdAt: { gte, lt }, carrierId: { not: null }, carrierCost: { not: null } },
      _sum: { carrierCost: true },
      _count: { _all: true },
    })

    let generated = 0
    let updated = 0
    for (const g of groups) {
      const carrierId = g.carrierId as string
      const carrierCode = carrierCodeById.get(carrierId) ?? carrierId
      const totalCost = new Prisma.Decimal(g._sum.carrierCost ?? 0)
      const itemCount = g._count._all
      const existing = await this.prisma.reconciliation.findUnique({
        where: { carrierCode_period: { carrierCode, period } },
      })
      if (existing) {
        await this.prisma.reconciliation.update({
          where: { id: existing.id },
          data: { totalCost, itemCount, currency: DEFAULT_CURRENCY },
        })
        updated++
      } else {
        await this.prisma.reconciliation.create({
          data: { carrierCode, period, currency: DEFAULT_CURRENCY, totalCost, itemCount, status: 'open' },
        })
        generated++
      }
    }
    this.logger.log(`[Billing] 生成承运商对账 period=${period} generated=${generated} updated=${updated}`)
    return { period, generated, updated }
  }

  /** 承运商对账列表（平台级，跨租户） */
  async listReconciliations(status?: string): Promise<ReconciliationItem[]> {
    const rows = await this.prisma.reconciliation.findMany({
      where: status ? { status } : {},
      orderBy: [{ period: 'desc' }, { carrierCode: 'asc' }],
    })
    return rows.map(mapReconciliation)
  }

  async getReconciliation(id: string): Promise<ReconciliationItem> {
    const r = await this.prisma.reconciliation.findUnique({ where: { id } })
    if (!r) throw new BusinessException('RECON_NOT_FOUND', `对账单不存在：${id}`, HttpStatus.NOT_FOUND)
    return mapReconciliation(r)
  }

  /** 匹配：open → matched */
  async matchReconciliation(id: string): Promise<ReconciliationItem> {
    const r = await this.prisma.reconciliation.findUnique({ where: { id } })
    if (!r) throw new BusinessException('RECON_NOT_FOUND', `对账单不存在：${id}`, HttpStatus.NOT_FOUND)
    if (r.status !== 'open') {
      throw new BusinessException('RECON_STATE_INVALID', `仅未对账可匹配，当前状态：${r.status}`, HttpStatus.BAD_REQUEST)
    }
    const u = await this.prisma.reconciliation.update({ where: { id }, data: { status: 'matched' } })
    this.logger.log(`[Billing] 匹配对账 recon=${id} carrier=${r.carrierCode}`)
    return mapReconciliation(u)
  }

  /** 关闭：→ closed（已 matched 或未匹配均可关闭，重复关闭视为无操作） */
  async closeReconciliation(id: string): Promise<ReconciliationItem> {
    const r = await this.prisma.reconciliation.findUnique({ where: { id } })
    if (!r) throw new BusinessException('RECON_NOT_FOUND', `对账单不存在：${id}`, HttpStatus.NOT_FOUND)
    if (r.status === 'closed') return mapReconciliation(r)
    const u = await this.prisma.reconciliation.update({ where: { id }, data: { status: 'closed' } })
    this.logger.log(`[Billing] 关闭对账 recon=${id} carrier=${r.carrierCode}`)
    return mapReconciliation(u)
  }

  // ---- 利润核算（§9 spread） ----------------------------------------------

  /** 平台利润 = Σ totalSell（应收）− Σ totalCost（应付）；跨租户聚合。 */
  async getProfitSummary(period: string): Promise<ProfitSummary> {
    const bills = await this.prisma.bill.findMany({ where: { period }, select: { totalSell: true } })
    const recons = await this.prisma.reconciliation.findMany({ where: { period }, select: { totalCost: true } })

    let totalSell = new Prisma.Decimal(0)
    for (const b of bills) totalSell = totalSell.plus(b.totalSell)
    let totalCost = new Prisma.Decimal(0)
    for (const r of recons) totalCost = totalCost.plus(r.totalCost)

    const profit = totalSell.minus(totalCost)
    const marginRate = totalSell.isZero() ? 0 : Number(profit) / Number(totalSell)
    return {
      period,
      currency: DEFAULT_CURRENCY,
      totalSell: Number(totalSell),
      totalCost: Number(totalCost),
      profit: Number(profit),
      marginRate,
      billCount: bills.length,
      reconciliationCount: recons.length,
    }
  }

  // ---- 利润多维拆解（§9 spread 报表化） ------------------------------------

  /**
   * 利润核算明细：总览 + 按租户（应收/应付/利润）+ 按承运商（应付成本）。
   * 租户级利润直接由 Shipment 的 sell_price − carrier_cost 按租户聚合得出（§9 spread 真实分摊）。
   */
  async getProfitBreakdown(period: string): Promise<ProfitBreakdown> {
    const { gte, lt } = this.periodRange(period)
    const carriers = await this.prisma.carrier.findMany({ select: { id: true, code: true } })
    const carrierCodeById = new Map(carriers.map((c) => [c.id, c.code]))

    const byTenantRows = await this.prisma.shipment.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte, lt }, sellPrice: { not: null }, carrierCost: { not: null } },
      _sum: { sellPrice: true, carrierCost: true },
    })
    const byTenant: TenantProfit[] = byTenantRows.map((g) => {
      const sell = new Prisma.Decimal(g._sum.sellPrice ?? 0)
      const cost = new Prisma.Decimal(g._sum.carrierCost ?? 0)
      const profit = sell.minus(cost)
      return {
        tenantId: g.tenantId,
        totalSell: Number(sell),
        totalCost: Number(cost),
        profit: Number(profit),
        marginRate: sell.isZero() ? 0 : Number(profit) / Number(sell),
      }
    })

    const byCarrierRows = await this.prisma.shipment.groupBy({
      by: ['carrierId'],
      where: { createdAt: { gte, lt }, carrierId: { not: null }, carrierCost: { not: null } },
      _sum: { carrierCost: true },
    })
    const byCarrier: CarrierCost[] = byCarrierRows.map((g) => ({
      carrierCode: carrierCodeById.get(g.carrierId as string) ?? (g.carrierId as string),
      totalCost: Number(g._sum.carrierCost ?? 0),
    }))

    const summary = await this.getProfitSummary(period)
    return { summary, byTenant, byCarrier }
  }

  /**
   * 利润趋势：最近 months 个账期的平台利润概览（用于趋势图，§9 spread 时序化）。
   * 从当前 UTC 月份往前推，逐月调用利润核算。
   */
  async getProfitTrend(months = 6): Promise<ProfitSummary[]> {
    const now = new Date()
    const out: ProfitSummary[] = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      out.push(await this.getProfitSummary(period))
    }
    return out
  }
}

function mapBill(b: {
  id: string
  tenantId: string
  period: string
  currency: string
  totalSell: Prisma.Decimal | number
  itemCount: number
  status: string
  createdAt: Date
}): BillItem {
  return {
    id: b.id,
    tenantId: b.tenantId,
    period: b.period,
    currency: b.currency,
    totalSell: Number(b.totalSell),
    itemCount: b.itemCount,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  }
}

function mapReconciliation(r: {
  id: string
  carrierCode: string
  period: string
  currency: string
  totalCost: Prisma.Decimal | number
  itemCount: number
  status: string
  createdAt: Date
}): ReconciliationItem {
  return {
    id: r.id,
    carrierCode: r.carrierCode,
    period: r.period,
    currency: r.currency,
    totalCost: Number(r.totalCost),
    itemCount: r.itemCount,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }
}
