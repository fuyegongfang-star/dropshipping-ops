/**
 * 审单引擎单测（任务 1.4，方案 §13/§18/§19）。
 * 覆盖：地址缺失→拒绝并挂起、地址完整→通过并 approved、非待审订单不可审。
 * 不依赖真实数据库（内存桩 Prisma + 状态机）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { OrderReviewService } from './order-review.service'
import { OrderStateMachineService } from '../order-state-machine.service'
import { AppLogger } from '../../../common/logger/app.logger'
import { OrderStatus } from '../order.constants'
import { BlacklistService } from './blacklist.service'
import { AddressCompletenessCheck } from './checks/address-completeness.check'
import { BlacklistCheck } from './checks/blacklist.check'
import { InventoryCheck } from './checks/inventory.check'
import { ComplianceCheck } from './checks/compliance.check'
import { PrismaClient } from '@prisma/client'

describe('OrderReviewService', () => {
  function build(initialStatus: string, recipient: unknown) {
    const holds: unknown[] = []
    let currentStatus = initialStatus
    const prisma = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({
            id: 'o1',
            tenantId: 't1',
            platformOrderNo: 'P1',
            status: currentStatus,
            recipient,
          }),
        update: jest.fn().mockImplementation((a: { data: { status: string } }) => {
          currentStatus = a.data.status
          return Promise.resolve({})
        }),
      },
      orderItem: { findMany: jest.fn().mockResolvedValue([{ skuId: null, quantity: 1 }]) },
      orderEvent: { create: jest.fn().mockResolvedValue({ id: 'e1' }) },
      orderHold: { create: jest.fn().mockImplementation((a: { data: unknown }) => {
        holds.push(a.data)
        return Promise.resolve({})
      }) },
    }
    const sm = new OrderStateMachineService(prisma as unknown as PrismaClient, new AppLogger())
    const svc = new OrderReviewService(
      prisma as unknown as PrismaClient,
      sm,
      new AddressCompletenessCheck(),
      new BlacklistCheck(new BlacklistService()),
      new InventoryCheck(),
      new ComplianceCheck(),
    )
    return { svc, getStatus: () => currentStatus, holds }
  }

  it('地址完整 → 审核通过并 approved', async () => {
    const recipient = { name: 'A', country: 'US', city: 'LA', address1: '1 St', zip: '90001' }
    const ctx = build(OrderStatus.PENDING_REVIEW, recipient)
    const res = await ctx.svc.review('o1')
    expect(res.approved).toBe(true)
    expect(ctx.getStatus()).toBe(OrderStatus.APPROVED)
  })

  it('地址缺失 → 拒绝并挂起 order_holds', async () => {
    const recipient = { country: 'US' } // 缺 name/city/address1
    const ctx = build(OrderStatus.PENDING_REVIEW, recipient)
    const res = await ctx.svc.review('o1')
    expect(res.approved).toBe(false)
    expect(ctx.getStatus()).toBe(OrderStatus.REJECTED)
    expect(ctx.holds.length).toBe(1) // 仅 address-completeness 失败（其余通过/跳过）
    expect(res.reasons[0]).toContain('address-completeness')
  })

  it('非待审订单不可审', async () => {
    const ctx = build(OrderStatus.APPROVED, { name: 'A', country: 'US', city: 'LA', address1: '1 St' })
    await expect(ctx.svc.review('o1')).rejects.toThrow()
  })
})
