/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 商户账单与承运商对账单测（任务 4.2，方案 §9/§10）。
 * 用进程内内存桩模拟 Prisma，覆盖聚合出账/对账、状态机与利润核算。
 */

import { BillingService } from './billing.service'
import { BusinessException } from '../../common/response/business.exception'

type AnyRow = Record<string, any>

// ---- 测试数据 ----------------------------------------------------------

const CARRIERS = [
  { id: 'c_yun', code: 'yunexpress' },
  { id: 'c_dhl', code: 'dhl' },
]

// 2026-10 期间：tenant t1 两单、t2 一单；承运商 yunexpress 两单、dhl 一单
const SHIPMENTS = [
  { id: 's1', tenantId: 't1', carrierId: 'c_yun', sellPrice: 128.5, carrierCost: 78.0, createdAt: new Date('2026-10-03T10:00:00.000Z') },
  { id: 's2', tenantId: 't1', carrierId: 'c_dhl', sellPrice: 210.0, carrierCost: 150.0, createdAt: new Date('2026-10-12T10:00:00.000Z') },
  { id: 's3', tenantId: 't2', carrierId: 'c_yun', sellPrice: 96.4, carrierCost: 60.0, createdAt: new Date('2026-10-20T10:00:00.000Z') },
  // 不属于 2026-10 的脏数据（应被账期过滤掉）
  { id: 's4', tenantId: 't1', carrierId: 'c_dhl', sellPrice: 999, carrierCost: 999, createdAt: new Date('2026-09-30T10:00:00.000Z') },
  // 缺价的单子：聚合时应被忽略
  { id: 's5', tenantId: 't2', carrierId: null, sellPrice: null, carrierCost: null, createdAt: new Date('2026-10-25T10:00:00.000Z') },
]

// ---- 内存桩 ------------------------------------------------------------

function matchWhere(row: AnyRow, where: any): boolean {
  if (!where) return true
  for (const key of Object.keys(where)) {
    const cond = where[key]
    if (key === 'createdAt') {
      if (cond.gte && new Date(row.createdAt) < new Date(cond.gte)) return false
      if (cond.lt && new Date(row.createdAt) >= new Date(cond.lt)) return false
      continue
    }
    if (cond && typeof cond === 'object' && 'not' in cond) {
      if (cond.not === null && row[key] === null) return false
      continue
    }
    if (row[key] !== cond) return false
  }
  return true
}

function makeStore<T extends AnyRow>(rows: T[]): { all: T[] } {
  return { all: rows.map((r) => ({ ...r })) }
}

function makePrismaStub() {
  const carriers = makeStore<AnyRow>(CARRIERS.map((c) => ({ ...c })))
  const shipments = makeStore<AnyRow>(SHIPMENTS.map((s) => ({ ...s })))
  const bills = makeStore<AnyRow>([])
  const recons = makeStore<AnyRow>([])
  let seq = 1000

  const groupBy = (model: AnyRow[], by: string[], where: any, sumKeys: string[]) => {
    const filtered = model.filter((r) => matchWhere(r, where))
    const groups = new Map<string, AnyRow[]>()
    for (const r of filtered) {
      const k = by.map((b) => String(r[b])).join('|')
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(r)
    }
    const out: any[] = []
    for (const rows of groups.values()) {
      const group: any = {}
      for (const b of by) group[b] = rows[0][b]
      const _sum: any = {}
      for (const sk of sumKeys) _sum[sk] = rows.reduce((acc, r) => acc + (r[sk] ?? 0), 0)
      group._sum = _sum
      group._count = { _all: rows.length }
      out.push(group)
    }
    return out
  }

  return {
    carrier: {
      findMany: () => carriers.all.map((c) => ({ ...c })),
    },
    shipment: {
      groupBy: ({ by, where, _sum }: any) => groupBy(shipments.all, by, where, Object.keys(_sum || {})),
    },
    bill: {
      findUnique: ({ where }: any) => {
        if (where.id) return bills.all.find((b) => b.id === where.id) || null
        if (where.tenantId_period)
          return bills.all.find((b) => b.tenantId === where.tenantId_period.tenantId && b.period === where.tenantId_period.period) || null
        return null
      },
      findMany: ({ where, orderBy }: any) => {
        let res = bills.all.filter((b) => matchWhere(b, where))
        if (orderBy?.period === 'desc') res = [...res].sort((a, b) => (a.period < b.period ? 1 : -1))
        return res.map((b) => ({ ...b }))
      },
      create: ({ data }: any) => {
        const row = { id: `bill_${++seq}`, createdAt: new Date('2026-10-15T00:00:00.000Z'), ...data }
        bills.all.push(row)
        return { ...row }
      },
      update: ({ where, data }: any) => {
        const row = bills.all.find((b) => b.id === where.id) as AnyRow
        Object.assign(row, data)
        return { ...row }
      },
    },
    reconciliation: {
      findUnique: ({ where }: any) => {
        if (where.id) return recons.all.find((r) => r.id === where.id) || null
        if (where.carrierCode_period)
          return recons.all.find((r) => r.carrierCode === where.carrierCode_period.carrierCode && r.period === where.carrierCode_period.period) || null
        return null
      },
      findMany: ({ where, orderBy }: any) => {
        let res = recons.all.filter((r) => matchWhere(r, where))
        if (orderBy)
          res = [...res].sort((a, b) =>
            a.period !== b.period ? (a.period < b.period ? 1 : -1) : a.carrierCode < b.carrierCode ? -1 : 1,
          )
        return res.map((r) => ({ ...r }))
      },
      create: ({ data }: any) => {
        const row = { id: `rec_${++seq}`, createdAt: new Date('2026-10-15T00:00:00.000Z'), ...data }
        recons.all.push(row)
        return { ...row }
      },
      update: ({ where, data }: any) => {
        const row = recons.all.find((r) => r.id === where.id) as AnyRow
        Object.assign(row, data)
        return { ...row }
      },
    },
  }
}

const loggerStub = { log: () => {}, error: () => {}, warn: () => {}, debug: () => {}, verbose: () => {} } as any

function makeService() {
  return new BillingService(makePrismaStub() as any, loggerStub)
}

// ---- 用例 --------------------------------------------------------------

describe('BillingService', () => {
  it('按账期聚合生成商户账单（按租户分离，忽略缺价与跨期单）', async () => {
    const svc = makeService()
    const res = await svc.generateBills('2026-10')
    expect(res.generated).toBe(2) // t1, t2
    const t1 = await svc.listBills('t1')
    expect(t1.length).toBe(1)
    expect(t1[0].totalSell).toBeCloseTo(128.5 + 210.0, 5)
    expect(t1[0].itemCount).toBe(2)
    expect(t1[0].status).toBe('draft')
  })

  it('生成幂等：二次生成转为更新而非新增', async () => {
    const svc = makeService()
    await svc.generateBills('2026-10')
    const res = await svc.generateBills('2026-10')
    expect(res.generated).toBe(0)
    expect(res.updated).toBe(2)
    const all = await svc.listBills('t1')
    expect(all.filter((b) => b.period === '2026-10').length).toBe(1)
  })

  it('承运商对账按承运商聚合 carrier_cost（carrierId→code）', async () => {
    const svc = makeService()
    const res = await svc.generateReconciliations('2026-10')
    expect(res.generated).toBe(2) // yunexpress(78+60), dhl(150)
    const list = await svc.listReconciliations()
    const yun = list.find((r) => r.carrierCode === 'yunexpress')
    expect(yun?.totalCost).toBeCloseTo(138.0, 5)
    expect(yun?.itemCount).toBe(2)
    const dhl = list.find((r) => r.carrierCode === 'dhl')
    expect(dhl?.totalCost).toBeCloseTo(150.0, 5)
  })

  it('账单状态机 draft→issued→settled；非法跃迁抛错', async () => {
    const svc = makeService()
    await svc.generateBills('2026-10')
    const bill = (await svc.listBills('t1'))[0]
    await expect(svc.settleBill(bill.id)).rejects.toBeInstanceOf(BusinessException) // 必须先出账
    const issued = await svc.issueBill(bill.id)
    expect(issued.status).toBe('issued')
    const settled = await svc.settleBill(bill.id)
    expect(settled.status).toBe('settled')
    await expect(svc.issueBill(bill.id)).rejects.toBeInstanceOf(BusinessException) // 已结清不能再出账
  })

  it('对账单状态机 open→matched→closed', async () => {
    const svc = makeService()
    await svc.generateReconciliations('2026-10')
    const rec = (await svc.listReconciliations())[0]
    const matched = await svc.matchReconciliation(rec.id)
    expect(matched.status).toBe('matched')
    const closed = await svc.closeReconciliation(rec.id)
    expect(closed.status).toBe('closed')
    const again = await svc.closeReconciliation(rec.id)
    expect(again.status).toBe('closed') // 幂等
    await expect(svc.matchReconciliation(rec.id)).rejects.toBeInstanceOf(BusinessException) // 已关闭不可再匹配
  })

  it('平台利润核算 = Σ sell − Σ cost 且毛利率正确', async () => {
    const svc = makeService()
    await svc.generateBills('2026-10')
    await svc.generateReconciliations('2026-10')
    const p = await svc.getProfitSummary('2026-10')
    const totalSell = 128.5 + 210.0 + 96.4
    const totalCost = 78.0 + 150.0 + 60.0
    expect(p.totalSell).toBeCloseTo(totalSell, 5)
    expect(p.totalCost).toBeCloseTo(totalCost, 5)
    expect(p.profit).toBeCloseTo(totalSell - totalCost, 5)
    expect(p.marginRate).toBeCloseTo((totalSell - totalCost) / totalSell, 5)
    expect(p.billCount).toBe(2)
    expect(p.reconciliationCount).toBe(2)
  })

  it('非法账期格式抛 BILL_PERIOD_INVALID', async () => {
    const svc = makeService()
    await expect(svc.generateBills('2026-10-01')).rejects.toBeInstanceOf(BusinessException)
  })
})
