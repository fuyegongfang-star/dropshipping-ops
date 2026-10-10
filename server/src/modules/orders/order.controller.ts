/**
 * 订单状态机控制器（任务 1.3 REST 入口，方案 §13/§11）。
 * 提供：状态转移、逆向流程发起。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { OrderStateMachineService } from './order-state-machine.service'
import { OrderTransitionResult, ReverseResult } from './order-state-machine.service'
import { OrderReviewService } from './review/order-review.service'
import { ReviewSummary } from './review/review.types'
import { TransitionDto, ReverseDto } from './order.dto'

@Controller('orders')
export class OrderController {
  constructor(
    private readonly stateMachine: OrderStateMachineService,
    private readonly reviewService: OrderReviewService,
  ) {}

  /** 状态转移（§13.1）：守卫校验 + 审计 */
  @Post(':id/transition')
  async transition(
    @Param('id') id: string,
    @Body() body: TransitionDto,
  ): Promise<ApiResponse<OrderTransitionResult>> {
    const result = await this.stateMachine.transition(id, body.to, body.operator ?? 'system')
    return ok(result)
  }

  /** 逆向流程发起（§13.2）：撤单/拦截/改址/退货 */
  @Post(':id/reverse')
  async reverse(
    @Param('id') id: string,
    @Body() body: ReverseDto,
  ): Promise<ApiResponse<ReverseResult>> {
    const result = await this.stateMachine.createReverse(
      id,
      body.type,
      body.cause,
      body.operator ?? 'system',
    )
    return ok(result)
  }

  /** 审单（§13/§18/§19）：运行校验关卡，通过→approved，失败→rejected+挂起 */
  @Post(':id/review')
  async review(@Param('id') id: string): Promise<ApiResponse<ReviewSummary>> {
    return ok(await this.reviewService.review(id))
  }
}
