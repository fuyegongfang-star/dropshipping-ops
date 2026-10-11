/**
 * 承运商适配器注册表（方案 §3：镜像 ChannelRegistryService，按 carrier code 分发）。
 * 支持两类注册：
 *   - registerAdapter：无状态适配器实例（如 MockCarrierAdapter，无需账号凭证）。
 *   - registerFactory：按租户承运商账号构建适配器实例（如 YunExpressAdapter，需 credentials，§2.2）。
 * 运行时 resolveForAccount 优先工厂（含凭证），回退无状态实例。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { BusinessException } from '../../common/response/business.exception'
import { CarrierAdapter } from './carrier-adapter.interface'
import { CarrierCode } from './carrier.constants'

/** 构建适配器所需的承运商账号上下文（含解密后的 authConfig，§17） */
export interface CarrierAccountContext {
  id: string // 承运商账号 ID（CarrierAccount.id）
  tenantId: string // 租户 ID
  carrierCode: string // 承运商代码（对齐 Carrier.code）
  authConfig?: unknown // 解密后的授权信息（§17，如 appId/apiKey/account/secret）
}

/** 承运商适配器工厂：按账号凭证构建适配器实例 */
export type CarrierAdapterFactory = (account: CarrierAccountContext) => CarrierAdapter

@Injectable()
export class CarrierRegistryService {
  // 无状态适配器实例（无需账号凭证）
  private readonly instances = new Map<CarrierCode, CarrierAdapter>()
  // 按账号凭证构建适配器的工厂（云途/DHL 等需凭证承运商，任务 3.2+）
  private readonly factories = new Map<CarrierCode, CarrierAdapterFactory>()

  /** 注册无状态适配器实例（如 Mock） */
  registerAdapter(adapter: CarrierAdapter): void {
    this.instances.set(adapter.getCode(), adapter)
  }

  /** 注册按账号凭证构建的适配器工厂（如云途/DHL，任务 3.2+） */
  registerFactory(code: CarrierCode, factory: CarrierAdapterFactory): void {
    this.factories.set(code, factory)
  }

  /** 是否工厂型（需账号凭证构建，§2.2） */
  isFactory(code: CarrierCode): boolean {
    return this.factories.has(code)
  }

  /**
   * 按承运商账号解析适配器：优先工厂（含凭证），回退无状态实例。
   * 未注册则抛业务异常（优雅失败，不崩服务）。
   */
  resolveForAccount(account: CarrierAccountContext): CarrierAdapter {
    const code = account.carrierCode as CarrierCode
    const factory = this.factories.get(code)
    if (factory) return factory(account)
    const instance = this.instances.get(code)
    if (instance) return instance
    throw new BusinessException(
      'CARRIER_ADAPTER_NOT_FOUND',
      `未注册承运商适配器: ${account.carrierCode}`,
      HttpStatus.BAD_REQUEST,
    )
  }

  /** 取无状态适配器实例（用于承运商级健康巡检/比价） */
  getAdapter(code: CarrierCode): CarrierAdapter {
    const instance = this.instances.get(code)
    if (!instance) {
      throw new BusinessException(
        'CARRIER_ADAPTER_NOT_FOUND',
        `无状态承运商适配器不存在: ${code}（该承运商为工厂型，需账号凭证）`,
        HttpStatus.BAD_REQUEST,
      )
    }
    return instance
  }

  /** 是否已注册某承运商（实例或工厂任一） */
  has(code: CarrierCode): boolean {
    return this.factories.has(code) || this.instances.has(code)
  }

  /** 列出所有已注册承运商代码（实例 + 工厂去重） */
  listCodes(): CarrierCode[] {
    return Array.from(new Set([...this.instances.keys(), ...this.factories.keys()]))
  }
}
