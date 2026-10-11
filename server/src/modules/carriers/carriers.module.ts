/**
 * 承运商模块（任务 3.1 CarrierAdapter 框架装配，方案 §3 承运商适配器架构）。
 * 提供：适配器注册表、承运商服务（目录读取+分发）、Mock 适配器（测试用）、REST 入口。
 * 新增承运商适配器（云途/DHL/4PX/燕文，任务 3.2~3.4）实现后在此追加注册工厂。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Module, OnModuleInit } from '@nestjs/common'
import { CarrierRegistryService } from './carrier-registry.service'
import { CarriersService } from './carriers.service'
import { CarriersController } from './carriers.controller'
import { MockCarrierAdapter } from './adapters/mock-carrier.adapter'

@Module({
  controllers: [CarriersController],
  providers: [CarrierRegistryService, CarriersService, MockCarrierAdapter],
  exports: [CarrierRegistryService, CarriersService],
})
export class CarriersModule implements OnModuleInit {
  constructor(private readonly registry: CarrierRegistryService, private readonly mock: MockCarrierAdapter) {}

  /** 模块初始化时注册无状态 Mock 实例；真实承运商在 3.2+ 注册工厂 */
  onModuleInit(): void {
    this.registry.registerAdapter(this.mock)
    // TODO(ops): 任务 3.2 云途 / 3.3 DHL / 3.4 4PX·燕文 注册工厂（按租户 CarrierAccount 构建，§2.2）
  }
}
