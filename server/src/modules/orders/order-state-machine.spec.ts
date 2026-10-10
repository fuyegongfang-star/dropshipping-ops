/**
 * 订单状态机单测（任务 1.3，方案 §13）。
 * 覆盖：合法/非法转移守卫、幂等、order_events 审计、逆向撤单流转。
 * 不依赖真实数据库（内存桩 Prisma）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { OrderStateMachineService } from './order-state-machine.service'
import { AppLogger } from '../../common/logger/app.logger'
import { OrderStatus, ReverseType } from './order.constants'
import { PrismaClient } from '@prisma/client'

describe('OrderStateMachineService', () => {
  /** 构造带桩 Prisma 的状态机服务 */
  function buildService(prisma: unknown): OrderStateMachineService {
    return new OrderStateMachineService(prisma as unknown as PrismaClient, new AppLogger())
  }

  function shopOrderPrisma(initialStatus: string) {
    const events: unknown[] = []
    const reverses: unknown[] = []
    let currentStatus = initialStatus
    return {
      events,
      reverses,
      getStatus: () => currentStatus,
      prisma: {
        order: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: 'o1', tenantId: 't1', status: currentStatus }),
          update: jest.fn().mockImplementation((args: { where: { id: string }; data: { status: string } }) => {
            currentStatus = args.data.status
            return Promise.resolve({ id: args.where.id, status: currentStatus })
          }),
        },
        orderEvent: { create: jest.fn().mockImplementation((a: { data: unknown }) => {
          events.push(a.data)
          return Promise.resolve({ id: 'e' })
        }) },
        reverseOrder: { create: jest.fn().mockImplementation((a: { data: unknown }) => {
          reverses.push(a.data)
          return Promise.resolve({ id: 'r1', status: 'pending' })
        }) },
      },
    }
  }

  it('合法转移：pending_review → approved 且写审计', async () => {
    const ctx = shopOrderPrisma(OrderStatus.PENDING_REVIEW)
    const sm = buildService(ctx.prisma)

    const res = await sm.transition('o1', OrderStatus.APPROVED, 'op1')
    expect(res.changed).toBe(true)
    expect(res.from).toBe(OrderStatus.PENDING_REVIEW)
    expect(res.to).toBe(OrderStatus.APPROVED)
    expect(ctx.prisma.order.update).toHaveBeenCalledTimes(1)
    expect(ctx.events.length).toBe(1)
    expect(ctx.events[0]).toMatchObject({ type: 'pending_review->approved', operator: 'op1' })
  })

  it('幂等：已在目标态不重复处理', async () => {
    const ctx = shopOrderPrisma(OrderStatus.APPROVED)
    const sm = buildService(ctx.prisma)

    const res = await sm.transition('o1', OrderStatus.APPROVED)
    expect(res.changed).toBe(false)
    expect(ctx.prisma.order.update).not.toHaveBeenCalled()
    expect(ctx.events.length).toBe(0)
  })

  it('非法转移：pending_review → picked_up 应拒绝', async () => {
    const ctx = shopOrderPrisma(OrderStatus.PENDING_REVIEW)
    const sm = buildService(ctx.prisma)

    await expect(sm.transition('o1', OrderStatus.PICKED_UP)).rejects.toThrow()
    expect(ctx.prisma.order.update).not.toHaveBeenCalled()
  })

  it('逆向撤单：pending_review 直接置 cancelled', async () => {
    const ctx = shopOrderPrisma(OrderStatus.PENDING_REVIEW)
    const sm = buildService(ctx.prisma)

    const res = await sm.createReverse('o1', ReverseType.CANCEL, '客户要求取消')
    expect(res.type).toBe(ReverseType.CANCEL)
    expect(ctx.prisma.reverseOrder.create).toHaveBeenCalledTimes(1)
    // 撤单触发状态转移 → cancelled
    expect(ctx.prisma.order.update).toHaveBeenCalledTimes(1)
    expect(ctx.getStatus()).toBe(OrderStatus.CANCELLED)
  })

  it('守卫函数：isAllowed 正确反映转移表', () => {
    const sm = buildService({})
    expect(sm.isAllowed(OrderStatus.PENDING_REVIEW, OrderStatus.APPROVED)).toBe(true)
    expect(sm.isAllowed(OrderStatus.PENDING_REVIEW, OrderStatus.PICKED_UP)).toBe(false)
    expect(sm.isAllowed(OrderStatus.DELIVERED, OrderStatus.COMPLETED)).toBe(true)
    expect(sm.isAllowed(OrderStatus.COMPLETED, OrderStatus.DELIVERED)).toBe(false)
    expect(sm.isTerminal(OrderStatus.COMPLETED)).toBe(true)
    expect(sm.isTerminal(OrderStatus.PENDING_REVIEW)).toBe(false)
  })
})
