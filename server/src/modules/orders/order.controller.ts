/**
 * 订单控制器（任务 1.3 REST 入口 + 可视化只读接口，方案 §13/§11）。
 * 写操作：状态转移、逆向流程发起、审单。
 * 读操作：订单列表、订单详情（配套前端「订单中心」可视化）。
 *
 * 负责人：自动开发引擎（写操作）｜ 人工补开发（读操作）｜ 最后修订：2026-10-11
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { OrderStateMachineService } from './order-state-machine.service'
import { OrderTransitionResult, ReverseResult } from './order-state-machine.service'
import { OrderReviewService } from './review/order-review.service'
import { ReviewSummary } from './review/review.types'
import { TransitionDto, ReverseDto } from './order.dto'
import { OrdersQueryService } from './orders-query.service'

@Controller('orders')
export class OrderController {
  constructor(
    private readonly stateMachine: OrderStateMachineService,
    private readonly reviewService: OrderReviewService,
    private readonly query: OrdersQueryService,
  ) {}

  /**
   * 订单列表（可按状态过滤，配套前端订单中心）
   * keyword：平台订单号 / 收件人模糊搜索（采购单录入选单用，任务 6.10）
   * take：返回条数上限（≤200）
   */
  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('keyword') keyword?: string,
    @Query('take') take?: string,
  ): Promise<ApiResponse<unknown>> {
    this.requireTenant(tenantId)
    const takeNum = take ? Number.parseInt(take, 10) : undefined
    return ok(
      await this.query.list(
        tenantId,
        status,
        keyword,
        Number.isFinite(takeNum) ? (takeNum as number) : undefined,
      ),
    )
  }

  /** 订单详情：明细 + 事件审计 + 逆向单 */
  @Get(':id')
  async detail(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    this.requireTenant(tenantId)
    return ok(await this.query.detail(tenantId, id))
  }

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

  /** 缺租户上下文时显式报错（机制上保证行级隔离不被遗漏，§17） */
  private requireTenant(tenantId?: string): void {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
  }
}
