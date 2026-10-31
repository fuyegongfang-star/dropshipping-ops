/**
 * WalletService 单测（任务 4.1，方案 §16）。
 * 用内存桩 Prisma（wallet + ledgerEntry 真实落内存）验证复式记账与资金流：
 * 充值→冻结→扣费→退款→结算 全链路，以及可用额度校验、信用账期。
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Test } from '@nestjs/testing'
import { WalletService } from './wallet.service'
import { AppLogger } from '../../common/logger/app.logger'
import { PrismaService } from '../../database/prisma.service'
import { TENANT_PRISMA } from '../../common/tenant/tenant-prisma.service'

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 内存桩：钱包按 id 与 (tenantId,currency) 双索引，ledger 存全部流水 */
function makePrismaStub() {
  const byId = new Map<string, any>()
  const byKey = new Map<string, string>()
  const ledger: any[] = []
  const ledgerOf = (walletId: string) => ledger.filter((r) => r.walletId === walletId)
  return {
    wallet: {
      findUnique: jest.fn(async ({ where }: any) => {
        const id = where.id ?? byKey.get(`${where.tenantId_currency.tenantId}:${where.tenantId_currency.currency}`)
        return (id && byId.get(id)) || null
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: 'w_' + Math.random().toString(36).slice(2, 8), ...data }
        byId.set(row.id, row)
        byKey.set(`${data.tenantId}:${data.currency}`, row.id)
        return row
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = byId.get(where.id)
        const merged = { ...row, ...data }
        byId.set(where.id, merged)
        return merged
      }),
    },
    ledgerEntry: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: 'l_' + ledger.length, createdAt: new Date(), ...data }
        ledger.push(row)
        return row
      }),
      findMany: jest.fn(async ({ where, orderBy, take, skip }: any) => {
        let rows = ledgerOf(where.walletId)
        if (orderBy?.createdAt === 'desc') rows = rows.slice().reverse()
        return rows.slice(skip || 0, (skip || 0) + (take || rows.length))
      }),
    },
    __ledger: ledger,
  }
}

describe('WalletService（§16 复式记账 / 预充值 / 信用账期）', () => {
  let svc: WalletService
  let prisma: any

  beforeEach(async () => {
    prisma = makePrismaStub()
    const moduleRef = await Test.createTestingModule({
      providers: [WalletService, AppLogger, { provide: PrismaService, useValue: prisma }, { provide: TENANT_PRISMA, useValue: prisma }],
    }).compile()
    svc = moduleRef.get(WalletService)
  })

  it('充值后余额增加并记 recharge 流水', async () => {
    const s = await svc.recharge('t1', { amount: 1000 })
    expect(s.balance).toBe(1000)
    expect(s.available).toBe(1000)
    const ledger = await svc.listLedger('t1')
    expect(ledger[0].type).toBe('recharge')
    expect(ledger[0].amount).toBe(1000)
    expect(ledger[0].balanceAfter).toBe(1000)
  })

  it('下单冻结占用可用额度，扣费优先消耗冻结', async () => {
    await svc.recharge('t2', { amount: 500, refType: 'order', refId: 'o1' })
    const f = await svc.freeze('t2', { amount: 200, refType: 'order', refId: 'o1' })
    expect(f.frozen).toBe(200)
    expect(f.available).toBe(300) // 500 - 200
    const c = await svc.charge('t2', { amount: 200, refType: 'order', refId: 'o1' })
    expect(c.frozen).toBe(0)
    expect(c.balance).toBe(300) // 500 - 200(扣费)
    expect(c.available).toBe(300)
  })

  it('可用额度不足时冻结抛 WALLET_INSUFFICIENT', async () => {
    await svc.recharge('t3', { amount: 100 })
    await expect(svc.freeze('t3', { amount: 200 })).rejects.toMatchObject({
      bizCode: 'WALLET_INSUFFICIENT',
    })
  })

  it('信用账期：可用额度 = 余额 - 冻结 + 授信', async () => {
    await svc.recharge('t4', { amount: 100 })
    const s = await svc.setCreditLimit('t4', { creditLimit: 500 })
    expect(s.creditLimit).toBe(500)
    expect(s.available).toBe(600) // 100 + 500
    // 超额冻结动用信用额度应通过
    const f = await svc.freeze('t4', { amount: 600 })
    expect(f.frozen).toBe(600)
    expect(f.available).toBe(0)
  })

  it('退款回钱包，结算扣减可用余额', async () => {
    await svc.recharge('t5', { amount: 800 })
    await svc.freeze('t5', { amount: 300, refType: 'order', refId: 'o9' })
    const r = await svc.refund('t5', { amount: 150, refType: 'refund', refId: 'o9' })
    expect(r.balance).toBe(950) // 800 + 150
    const st = await svc.settle('t5', { amount: 100, refType: 'settle', refId: 'c1' })
    expect(st.balance).toBe(850) // 950 - 100
  })

  it('取消订单解冻释放冻结额度', async () => {
    await svc.recharge('t6', { amount: 500 })
    await svc.freeze('t6', { amount: 200, refId: 'oX' })
    const u = await svc.unfreeze('t6', { amount: 200, refId: 'oX' })
    expect(u.frozen).toBe(0)
    expect(u.available).toBe(500)
  })

  it('流水只增不改：每笔金额变动均落 ledger_entries', async () => {
    await svc.recharge('t7', { amount: 1000 })
    await svc.freeze('t7', { amount: 300 })
    await svc.charge('t7', { amount: 300 })
    const all = await svc.listLedger('t7')
    expect(all.length).toBe(3)
    expect(all.map((l) => l.type)).toEqual(['charge', 'freeze', 'recharge'])
  })
})
