/**
 * 订单模块（任务 1.3，方案 §13 订单状态机与逆向流程）。
 * 提供：状态机服务（守卫/幂等/审计/逆向）与 REST 入口。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Module } from '@nestjs/common'
import { OrderStateMachineService } from './order-state-machine.service'
import { OrderController } from './order.controller'
import { OrderReviewService } from './review/order-review.service'
import { BlacklistService } from './review/blacklist.service'
import { AddressCompletenessCheck } from './review/checks/address-completeness.check'
import { BlacklistCheck } from './review/checks/blacklist.check'
import { InventoryCheck } from './review/checks/inventory.check'
import { ComplianceCheck } from './review/checks/compliance.check'

@Module({
  controllers: [OrderController],
  providers: [
    OrderStateMachineService,
    OrderReviewService,
    BlacklistService,
    AddressCompletenessCheck,
    BlacklistCheck,
    InventoryCheck,
    ComplianceCheck,
  ],
  exports: [OrderStateMachineService, OrderReviewService],
})
export class OrdersModule {}
