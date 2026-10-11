/**
 * 渠道模块（任务 1.1/1.2 ChannelAdapter 框架装配，方案 §3 渠道接入）。
 * 提供：适配器注册表、拉单同步服务、Mock 适配器（测试用）、Shopify 适配器工厂与 REST 入口。
 * 新增渠道适配器（Amazon/淘宝/抖音，任务 2.1+）实现后在此追加注册工厂。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Module, OnModuleInit } from '@nestjs/common'
import { ChannelRegistryService } from './channel-registry.service'
import { ChannelSyncService } from './channel-sync.service'
import { ChannelSyncController } from './channel-sync.controller'
import { ShopsController } from './shops.controller'
import { ShopsService } from './shops.service'
import { MockChannelAdapter } from './adapters/mock-channel.adapter'
import { ShopifyAdapterFactory } from './adapters/shopify/shopify-adapter'
import { AmazonAdapterFactory } from './adapters/amazon/amazon-adapter'
import { ChannelPlatform } from './channel.constants'
import { CatalogModule } from '../catalog/catalog.module'

@Module({
  controllers: [ChannelSyncController, ShopsController],
  providers: [
    ChannelRegistryService,
    ChannelSyncService,
    ShopsService,
    MockChannelAdapter,
    ShopifyAdapterFactory,
    AmazonAdapterFactory,
  ],
  exports: [ChannelRegistryService, ChannelSyncService],
  imports: [CatalogModule],
})
export class ChannelsModule implements OnModuleInit {
  constructor(
    private readonly registry: ChannelRegistryService,
    private readonly mock: MockChannelAdapter,
    private readonly shopifyFactory: ShopifyAdapterFactory,
    private readonly amazonFactory: AmazonAdapterFactory,
  ) {}

  /** 模块初始化时注册无状态实例与工厂型适配器 */
  onModuleInit(): void {
    // Mock：无状态实例（开发/测试）
    this.registry.registerAdapter(this.mock)
    // Shopify：按店铺凭证构建适配器实例
    this.registry.registerFactory(ChannelPlatform.SHOPIFY, (shop) => this.shopifyFactory.build(shop))
    // Amazon：按店铺凭证构建适配器实例（阶段1 评估，完整对接见阶段5，§29）
    this.registry.registerFactory(ChannelPlatform.AMAZON, (shop) => this.amazonFactory.build(shop))
  }
}
