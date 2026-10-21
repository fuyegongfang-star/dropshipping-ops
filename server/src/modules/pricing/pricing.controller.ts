/**
 * 比价 / 试算门户入口（任务 3.5，方案 §5 / §4.1）。
 * 暴露 POST /pricing/compare：按租户调用比价引擎，返回 4 层执行痕迹 + 报价/锁价。
 * 试算模式（trial=true）返回多结果列表供商户自选；代运营模式锁价 selected（§4.1）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Body, Controller, Post } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { PricingEngineService } from './pricing-engine.service'
import { CompareRequest } from './pricing.types'
import {
  FulfillmentRouterService,
  RouteRequest,
} from './fulfillment-router.service'

@Controller('pricing')
export class PricingController {
  constructor(
    private readonly engine: PricingEngineService,
    private readonly router: FulfillmentRouterService,
  ) {}

  /** 比价/试算（§5 四层 + §4.1 试算开关） */
  @Post('compare')
  async compare(
    @TenantId() tenantId: string,
    @Body() req: CompareRequest,
  ): Promise<ApiResponse<unknown>> {
    return ok(await this.engine.compare(tenantId, req))
  }

  /**
   * 履约路由（模式A 自动选渠道，任务 1.5，§4/§5）：给定订单发货上下文与策略，
   * 自动从比价引擎结果中挑选最优承运商/物流产品，返回推荐 + 备选 + 推荐理由。
   */
  @Post('route')
  async route(
    @TenantId() tenantId: string,
    @Body() req: RouteRequest,
  ): Promise<ApiResponse<unknown>> {
    return ok(await this.router.route(tenantId, req))
  }
}
