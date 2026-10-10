/**
 * 审单引擎服务（任务 1.4，方案 §13/§18/§19）。
 * 编排：加载待审订单 → 逐个运行 ReviewCheck → 全通过则 approved，否则 rejected 并挂起 order_holds。
 * 校验可插拔（§18 地址标准化、§19 合规自动化后续补充，§26 风控黑名单）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { BusinessException } from '../../../common/response/business.exception'
import { OrderStateMachineService } from '../order-state-machine.service'
import { OrderStatus } from '../order.constants'
import {
  AddressCompletenessCheck,
} from './checks/address-completeness.check'
import { BlacklistCheck } from './checks/blacklist.check'
import { InventoryCheck } from './checks/inventory.check'
import { ComplianceCheck } from './checks/compliance.check'
import { ReviewCheck, ReviewContext, ReviewResult, ReviewSummary } from './review.types'

@Injectable()
export class OrderReviewService {
  // 已注册校验（新增校验在此追加；亦可在模块内用数组注入，这里显式列出便于阅读）
  private readonly checks: ReviewCheck[]

  constructor(
    private readonly prisma: PrismaClient,
    private readonly stateMachine: OrderStateMachineService,
    private readonly addressCheck: AddressCompletenessCheck,
    private readonly blacklistCheck: BlacklistCheck,
    private readonly inventoryCheck: InventoryCheck,
    private readonly complianceCheck: ComplianceCheck,
  ) {
    this.checks = [
      this.addressCheck,
      this.blacklistCheck,
      this.inventoryCheck,
      this.complianceCheck,
    ]
  }

  /**
   * 审单（§13 审单引擎）。
   * 仅 pending_review 可审；全通过 → approved，任一失败 → rejected + 挂起 order_holds。
   */
  async review(orderId: string): Promise<ReviewSummary> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, platformOrderNo: true, status: true, recipient: true },
    })
    if (!order) {
      throw new BusinessException('ORDER_NOT_FOUND', '订单不存在', HttpStatus.NOT_FOUND)
    }
    // 仅待审订单可审（§13.1 状态机约束）
    if (order.status !== OrderStatus.PENDING_REVIEW) {
      throw new BusinessException(
        'ORDER_NOT_REVIEWABLE',
        `订单状态不可审: ${order.status}`,
        HttpStatus.BAD_REQUEST,
      )
    }

    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      select: { skuId: true, quantity: true },
    })
    const ctx: ReviewContext = {
      tenantId: order.tenantId,
      orderId,
      platformOrderNo: order.platformOrderNo,
      recipient: (order.recipient as Record<string, unknown>) ?? null,
      items: items.map((i) => ({ quantity: i.quantity })),
    }

    const results: ReviewResult[] = []
    for (const check of this.checks) {
      results.push(await check.check(ctx))
    }
    const failed = results.filter((r) => !r.passed && !r.skipped)
    const approved = failed.length === 0

    if (approved) {
      await this.stateMachine.transition(orderId, OrderStatus.APPROVED, 'review-engine')
      return { orderId, approved: true, results, reasons: [] }
    }

    // 拒绝：转移状态 + 逐条挂起（order_holds，§13.3）
    const reasons = failed.map((f) => `${f.checkName}: ${f.reason ?? 'failed'}`)
    await this.stateMachine.transition(orderId, OrderStatus.REJECTED, 'review-engine')
    for (const f of failed) {
      await this.prisma.orderHold.create({
        data: {
          tenantId: order.tenantId,
          orderId,
          reason: `${f.checkName}: ${f.reason ?? 'failed'}`,
        },
      })
    }
    return { orderId, approved: false, results, reasons }
  }
}
