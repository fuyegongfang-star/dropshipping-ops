/**
 * 订单状态机服务（任务 1.3，方案 §13 状态机与逆向流程）。
 * 职责：状态转移守卫（非法转移拒绝）、幂等（同态不重复处理）、审计（写 order_events）、
 *      逆向流程（撤单/拦截/改址/退货 → 建 ReverseOrder，§13.2）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import {
  ALLOWED_TRANSITIONS,
  OrderStatus,
  ReverseType,
  TERMINAL_STATUSES,
} from './order.constants'

/** 状态转移结果 */
export interface OrderTransitionResult {
  orderId: string
  from: OrderStatus
  to: OrderStatus
  changed: boolean // 是否实际发生转移（幂等：已在目标态则为 false）
}

/** 逆向流程结果 */
export interface ReverseResult {
  reverseId: string
  type: ReverseType
  status: string // ReverseOrder.status（pending/processing/done/failed）
}

@Injectable()
export class OrderStateMachineService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  /** 判定转移是否合法（守卫） */
  isAllowed(from: OrderStatus, to: OrderStatus): boolean {
    return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
  }

  /**
   * 状态转移（§13.1）。
   * 幂等：已在目标态则跳过（changed=false）；非法转移抛业务异常；每次转移写 order_events 审计。
   */
  async transition(
    orderId: string,
    to: OrderStatus,
    operator = 'system',
  ): Promise<OrderTransitionResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, status: true },
    })
    if (!order) {
      throw new BusinessException('ORDER_NOT_FOUND', '订单不存在', HttpStatus.NOT_FOUND)
    }
    const from = order.status as OrderStatus

    // 幂等：已在目标态，不重复处理（§13.1 幂等要求）
    if (from === to) {
      return { orderId, from, to, changed: false }
    }
    if (!this.isAllowed(from, to)) {
      throw new BusinessException(
        'ORDER_TRANSITION_INVALID',
        `非法状态转移: ${from}→${to}`,
        HttpStatus.BAD_REQUEST,
      )
    }

    await this.prisma.order.update({ where: { id: orderId }, data: { status: to } })
    // 审计日志（§13.1 每次转移写 order_events）
    await this.prisma.orderEvent.create({
      data: {
        tenantId: order.tenantId,
        orderId,
        type: `${from}->${to}`,
        from,
        to,
        operator,
      },
    })
    this.logger.log(`订单状态转移 ${orderId}: ${from}→${to} by ${operator}`, 'OrderSM')
    return { orderId, from, to, changed: true }
  }

  /**
   * 逆向流程（§13.2）：建 ReverseOrder 记录。
   * 撤单（cancel）若订单处于可撤态（pending_review/approved，未推单）直接置 cancelled。
   */
  async createReverse(
    orderId: string,
    type: ReverseType,
    cause: string,
    operator = 'system',
  ): Promise<ReverseResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, status: true },
    })
    if (!order) {
      throw new BusinessException('ORDER_NOT_FOUND', '订单不存在', HttpStatus.NOT_FOUND)
    }

    // 撤单：未推单（pending_review/approved）可直接取消（已推单需先走拦截，§13.2）
    if (
      type === ReverseType.CANCEL &&
      (order.status === OrderStatus.PENDING_REVIEW || order.status === OrderStatus.APPROVED)
    ) {
      await this.transition(orderId, OrderStatus.CANCELLED, operator)
    }

    const reverse = await this.prisma.reverseOrder.create({
      data: { tenantId: order.tenantId, orderId, type, status: 'pending', cause },
      select: { id: true, status: true },
    })
    return { reverseId: reverse.id, type, status: reverse.status }
  }

  /** 是否终态（不可再转移） */
  isTerminal(status: OrderStatus): boolean {
    return TERMINAL_STATUSES.has(status)
  }
}
