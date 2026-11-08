/**
 * 承运商模块（任务 3.1 CarrierAdapter 框架装配，方案 §3 承运商适配器架构）。
 * 提供：适配器注册表、承运商服务（目录读取+分发）、Mock 适配器（测试用）、REST 入口。
 * 新增承运商适配器（云途/DHL/4PX/燕文，任务 3.2~3.4）实现后在此追加注册工厂。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Module, OnModuleInit } from '@nestjs/common'
import { AppLogger } from '../../common/logger/app.logger'
import { RetryableHttpService } from '../../common/http/retryable-http.service'
import { CacheModule, CacheService } from '../../common/cache'
import { CarrierCode } from './carrier.constants'
import { CarrierRegistryService } from './carrier-registry.service'
import { CarriersService } from './carriers.service'
import { CarriersController } from './carriers.controller'
import { ShipmentLegsService } from './shipment-legs.service'
import { LabelService } from './label/label.service'
import { CustomsService } from './customs/customs.service'
import { TrackingService } from './tracking/tracking.service'
import { AddressService } from './address/address.service'
import { ZoneMapService } from './address/zone-map.service'
import { AggregatorService } from './aggregator/aggregator.service'
import { MockCarrierAdapter } from './adapters/mock-carrier.adapter'
import { YunExpressAdapter } from './adapters/yunexpress/yunexpress.adapter'
import { DhlAdapter } from './adapters/dhl/dhl.adapter'
import { FourPxAdapter } from './adapters/fourpx/fourpx.adapter'
import { YanwenAdapter } from './adapters/yanwen/yanwen.adapter'

@Module({
  imports: [CacheModule],
  controllers: [CarriersController],
  providers: [CarrierRegistryService, CarriersService, ShipmentLegsService, LabelService, CustomsService, TrackingService, AddressService, ZoneMapService, AggregatorService, MockCarrierAdapter],
  exports: [CarrierRegistryService, CarriersService, ShipmentLegsService, LabelService, CustomsService, TrackingService, AddressService, ZoneMapService, AggregatorService, CacheModule],
})
export class CarriersModule implements OnModuleInit {
  constructor(
    private readonly registry: CarrierRegistryService,
    private readonly mock: MockCarrierAdapter,
    private readonly http: RetryableHttpService,
    private readonly logger: AppLogger,
    private readonly cache: CacheService,
  ) {}

  /** 模块初始化时注册无状态 Mock 实例；真实承运商（需账号凭证）注册工厂（§2.2） */
  onModuleInit(): void {
    this.registry.registerAdapter(this.mock)
    // 3.2 云途：注册工厂（按租户 CarrierAccount 凭证构建，OAuth2+HMAC，§1.1）
    // 11.3：注入共享 CacheService，令牌多实例共享，避免重复换取触发云途限流
    this.registry.registerFactory(CarrierCode.YUNEXPRESS, (account) =>
      new YunExpressAdapter(account, this.http, this.logger, this.cache),
    )
    // 3.3 DHL：注册工厂（OAuth2 Basic 鉴权 + DHL-API-Key，轮询型无订阅，§1.1/§1.2.2）
    this.registry.registerFactory(CarrierCode.DHL, (account) =>
      new DhlAdapter(account, this.http, this.logger, this.cache),
    )
    // 3.4 4PX：注册工厂（MD5 签名，支持比价/建单/面单/轨迹/取消，轮询无订阅，§1.1）
    this.registry.registerFactory(CarrierCode.FOURPX, (account) =>
      new FourPxAdapter(account, this.http, this.logger),
    )
    // 3.4 燕文：注册工厂（MD5 签名，仅建单/面单/轨迹，§1.1）
    this.registry.registerFactory(CarrierCode.YANWEN, (account) =>
      new YanwenAdapter(account, this.http, this.logger),
    )
  }
}
