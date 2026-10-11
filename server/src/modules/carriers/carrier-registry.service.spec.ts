/**
 * CarrierRegistryService 单测（任务 3.1，方案 §3 镜像 ChannelRegistryService）。
 * 覆盖：注册实例/工厂/分发/能力探测/未注册抛异常。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { CarrierRegistryService, CarrierAccountContext } from './carrier-registry.service'
import { MockCarrierAdapter } from './adapters/mock-carrier.adapter'
import { RetryableHttpService } from '../../common/http/retryable-http.service'
import { AppLogger } from '../../common/logger/app.logger'
import { CarrierCode } from './carrier.constants'
import { CarrierAdapter } from './carrier-adapter.interface'

describe('CarrierRegistryService', () => {
  function build(): { registry: CarrierRegistryService; mock: MockCarrierAdapter } {
    const registry = new CarrierRegistryService()
    const mock = new MockCarrierAdapter(new RetryableHttpService(), new AppLogger())
    registry.registerAdapter(mock)
    return { registry, mock }
  }

  it('注册实例后可分发、判存在、列清单', () => {
    const { registry, mock } = build()
    expect(registry.has(CarrierCode.MOCK)).toBe(true)
    expect(registry.getAdapter(CarrierCode.MOCK)).toBe(mock)
    expect(registry.listCodes()).toContain(CarrierCode.MOCK)
  })

  it('工厂型注册后 resolveForAccount 优先工厂（含凭证）', () => {
    const registry = new CarrierRegistryService()
    const built: CarrierAdapter[] = []
    registry.registerFactory(CarrierCode.DHL, (account: CarrierAccountContext) => {
      const inst = new MockCarrierAdapter(new RetryableHttpService(), new AppLogger())
      built.push(inst)
      void account // 工厂可读取 account.authConfig 构建带凭证实例（3.3 落地）
      return inst
    })
    expect(registry.isFactory(CarrierCode.DHL)).toBe(true)
    const adapter = registry.resolveForAccount({
      id: 'a1',
      tenantId: 't1',
      carrierCode: 'dhl',
      authConfig: { key: 'x' },
    })
    // 工厂被调用并返回其构建的实例（真实 DHL 适配器在 3.3 注册，getCode 即 dhl）
    expect(adapter).toBe(built[0])
    expect(built).toHaveLength(1)
  })

  it('未注册承运商取实例抛业务异常（优雅失败）', () => {
    const registry = new CarrierRegistryService()
    expect(() => registry.getAdapter(CarrierCode.YUNEXPRESS)).toThrow()
  })

  it('未注册承运商 resolveForAccount 抛业务异常', () => {
    const registry = new CarrierRegistryService()
    expect(() =>
      registry.resolveForAccount({ id: 'a', tenantId: 't', carrierCode: 'yunexpress' }),
    ).toThrow()
  })
})
