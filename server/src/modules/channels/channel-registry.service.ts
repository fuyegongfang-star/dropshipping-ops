/**
 * 渠道适配器注册表（方案 §3：CarrierRegistry 同构，按平台 code 分发）。
 * 支持两类注册：
 *   - registerAdapter：无状态适配器实例（如 MockAdapter，无需店铺凭证）。
 *   - registerFactory：按店铺凭证构建适配器实例（如 ShopifyAdapter，需 shopDomain/accessToken）。
 * 运行时 resolveForShop 优先工厂（含凭证），回退无状态实例。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { BusinessException } from '../../common/response/business.exception'
import { ChannelAdapter } from './channel-adapter.interface'
import { ChannelPlatform } from './channel.constants'

/** 构建适配器所需的店铺上下文（含加密存储的 authConfig，§17） */
export interface ShopCredentialContext {
  id: string // 店铺 ID
  tenantId: string // 租户 ID
  platform: string // 平台代码（对齐 ChannelPlatform）
  authConfig?: unknown // 平台授权信息（解密后注入，§17）
}

/** 渠道适配器工厂：按店铺凭证构建适配器实例 */
export type ChannelAdapterFactory = (shop: ShopCredentialContext) => ChannelAdapter

@Injectable()
export class ChannelRegistryService {
  // 无状态适配器实例（无需店铺凭证）
  private readonly instances = new Map<ChannelPlatform, ChannelAdapter>()
  // 按店铺凭证构建适配器的工厂（Shopify 等需凭证渠道）
  private readonly factories = new Map<ChannelPlatform, ChannelAdapterFactory>()

  /** 注册无状态适配器实例 */
  registerAdapter(adapter: ChannelAdapter): void {
    this.instances.set(adapter.getPlatform(), adapter)
  }

  /** 注册按店铺凭证构建的适配器工厂 */
  registerFactory(platform: ChannelPlatform, factory: ChannelAdapterFactory): void {
    this.factories.set(platform, factory)
  }

  /**
   * 按店铺解析适配器：优先工厂（含凭证），回退无状态实例。
   * 未注册则抛业务异常（优雅失败，不崩服务）。
   */
  resolveForShop(shop: ShopCredentialContext): ChannelAdapter {
    const factory = this.factories.get(shop.platform as ChannelPlatform)
    if (factory) return factory(shop)
    const instance = this.instances.get(shop.platform as ChannelPlatform)
    if (instance) return instance
    throw new BusinessException(
      'CHANNEL_ADAPTER_NOT_FOUND',
      `未注册渠道适配器: ${shop.platform}`,
      HttpStatus.BAD_REQUEST,
    )
  }

  /** 取无状态适配器实例（用于平台级健康巡检） */
  getAdapter(platform: ChannelPlatform): ChannelAdapter {
    const instance = this.instances.get(platform)
    if (!instance) {
      throw new BusinessException(
        'CHANNEL_ADAPTER_NOT_FOUND',
        `无状态渠道适配器不存在: ${platform}（该平台为工厂型，需店铺凭证）`,
        HttpStatus.BAD_REQUEST,
      )
    }
    return instance
  }

  /** 是否已注册某平台（实例或工厂任一） */
  has(platform: ChannelPlatform): boolean {
    return this.factories.has(platform) || this.instances.has(platform)
  }

  /** 列出所有已注册平台（实例 + 工厂去重） */
  listPlatforms(): ChannelPlatform[] {
    return Array.from(new Set([...this.instances.keys(), ...this.factories.keys()]))
  }
}
