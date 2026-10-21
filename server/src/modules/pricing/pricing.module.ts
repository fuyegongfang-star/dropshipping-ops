/**
 * 比价引擎模块（任务 3.5，方案 §5）。
 * 装配：比价引擎服务、可达性服务、试算入口；复用 CarriersModule 的注册表与服务（§3）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Module } from '@nestjs/common'
import { CarriersModule } from '../carriers/carriers.module'
import { PricingController } from './pricing.controller'
import { PricingEngineService } from './pricing-engine.service'
import { ReachabilityService } from './reachability.service'
import { FxService } from './markup/fx.service'
import { MarkupRulesService } from './markup/markup-rules.service'
import { MarkupEngineService } from './markup/markup-engine.service'
import { MarkupConfigService } from './markup/markup-config.service'
import { MarkupConfigController } from './markup/markup-config.controller'
import { FxController } from './markup/fx.controller'
import { QuotesController } from './quote/quotes.controller'
import { QuotesService } from './quote/quotes.service'
import { LogisticsProductController } from './product/logistics-product.controller'
import { LogisticsProductService } from './product/logistics-product.service'
import { FulfillmentRouterService } from './fulfillment-router.service'

@Module({
  imports: [CarriersModule],
  controllers: [
    PricingController,
    QuotesController,
    LogisticsProductController,
    MarkupConfigController,
    FxController,
  ],
  providers: [
    PricingEngineService,
    ReachabilityService,
    FxService,
    MarkupRulesService,
    MarkupEngineService,
    MarkupConfigService,
    QuotesService,
    LogisticsProductService,
    FulfillmentRouterService,
  ],
  exports: [PricingEngineService, MarkupEngineService, LogisticsProductService],
})
export class PricingModule {}
