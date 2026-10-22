/**
 * 物流回传与轨迹模块（任务 1.6，方案 §3 推单回传 / §6 轨迹与异常）。
 * 装配：ShipmentsService（建单/回传/轨迹）+ REST 入口；复用 carriers/channels/orders 三模块能力。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-22
 */

import { Module } from '@nestjs/common'
import { ShipmentsService } from './shipments.service'
import { ShipmentsController } from './shipments.controller'
import { CarriersModule } from '../carriers/carriers.module'
import { ChannelsModule } from '../channels/channels.module'
import { OrdersModule } from '../orders/orders.module'

@Module({
  imports: [CarriersModule, ChannelsModule, OrdersModule],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
