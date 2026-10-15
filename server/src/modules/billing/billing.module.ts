/**
 * 商户账单与承运商对账模块（任务 4.2，方案 §9/§10）。
 * 装配账单服务与 REST 入口；依赖 PrismaService（全局）与 AppLogger。
 *
 * 负责人：自动开发引擎 ｜ 2026-10-15
 */

import { Module } from '@nestjs/common'
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
