/**
 * 平台凭证 ↔ 适配器注册表 桥接服务单测（任务 10.1 / 11.1）。
 *
 * 覆盖：① 凭证缺失时不桥接（优雅降级）；② 凭证存在且注册表有工厂时返回真实实例；
 *       ③ 非承运商侧平台正确分流；④ 渠道侧（淘宝）演示实例桥接；
 *       ⑤ integrationStatus 全平台快照结构与 honest 标注（realApiTodo 恒为 true）。
 *
 * 不依赖真实 YunExpressAdapter 等实现，仅注册极简 fake 工厂/实例验证桥接调度逻辑。
 * 凭证存储端口统一异步（11.1 下沉 Prisma），本测试相应 await。
 */

import { Test } from '@nestjs/testing'
import { SecretEncryptionService } from '../../common/security/secret-encryption.service'
import {
  CREDENTIAL_STORE,
  InMemoryCredentialStore,
} from './credential-store.port'
import { PlatformCredentialService } from './platform-credential.service'
import { PlatformIntegrationBridgeService } from './integration-bridge.service'
import { CarrierRegistryService } from '../carriers/carrier-registry.service'
import { ChannelRegistryService } from '../channels/channel-registry.service'
import { CarrierCode } from '../carriers/carrier.constants'
import { ChannelPlatform } from '../channels/channel.constants'
import { PlatformKind } from './platform-credentials.constants'
import type { CarrierAdapter } from '../carriers/carrier-adapter.interface'
import type { ChannelAdapter } from '../channels/channel-adapter.interface'

const TENANT = 't_bridge'

/** 极简 fake 承运适配器（桥接仅需要可返回实例，不调用其业务方法） */
const fakeCarrier = {
  getCode: () => CarrierCode.YUNEXPRESS,
  getCapabilities: () => [],
  healthCheck: async () => ({ healthy: true, message: 'fake' }),
  getRates: async () => [],
  createShipment: async () => ({}) as never,
  getLabel: async () => ({}) as never,
  getTracking: async () => ({}) as never,
  cancelShipment: async () => undefined,
  subscribeTracking: async () => undefined,
} as unknown as CarrierAdapter

/** 极简 fake 渠道适配器 */
const fakeChannel = {
  getPlatform: () => ChannelPlatform.TAOBAO,
  healthCheck: async () => ({ healthy: true, message: 'fake' }),
  pullOrders: async () => [],
  acknowledgeOrders: async () => undefined,
  pushFulfillment: async () => ({}) as never,
  fetchOrderStatus: async () => 'unknown' as never,
  cancelOrder: async () => undefined,
  getTracking: async () => ({}) as never,
} as unknown as ChannelAdapter

describe('PlatformIntegrationBridgeService', () => {
  let bridge: PlatformIntegrationBridgeService
  let credentials: PlatformCredentialService
  let carrierRegistry: CarrierRegistryService
  let channelRegistry: ChannelRegistryService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecretEncryptionService,
        { provide: CREDENTIAL_STORE, useClass: InMemoryCredentialStore },
        PlatformCredentialService,
        CarrierRegistryService,
        ChannelRegistryService,
        PlatformIntegrationBridgeService,
      ],
    }).compile()
    bridge = moduleRef.get(PlatformIntegrationBridgeService)
    credentials = moduleRef.get(PlatformCredentialService)
    carrierRegistry = moduleRef.get(CarrierRegistryService)
    channelRegistry = moduleRef.get(ChannelRegistryService)
    // 注册 fake 工厂/实例，模拟真实注册表装配结果
    carrierRegistry.registerFactory(CarrierCode.YUNEXPRESS, () => fakeCarrier)
    channelRegistry.registerAdapter(fakeChannel)
  })

  it('无凭证时承运商侧不桥接，返回可读原因', async () => {
    const res = await bridge.resolveCarrierAdapter(TENANT, PlatformKind.YUNEXPRESS)
    expect(res.resolved).toBe(false)
    expect(res.reason).toContain('未配置')
  })

  it('有凭证且注册表有工厂时返回真实承运商适配器实例', async () => {
    await credentials.setCredential(TENANT, PlatformKind.YUNEXPRESS, {
      appId: 'a',
      appKey: 'k',
      secret: 's',
    })
    const res = await bridge.resolveCarrierAdapter(TENANT, PlatformKind.YUNEXPRESS)
    expect(res.resolved).toBe(true)
    expect(res.adapterCode).toBe('yunexpress')
    expect(res.adapter).toBe(fakeCarrier)
  })

  it('非承运商侧平台（淘宝）经 resolveCarrierAdapter 正确拒绝', async () => {
    const res = await bridge.resolveCarrierAdapter(TENANT, PlatformKind.TAOBAO)
    expect(res.resolved).toBe(false)
    expect(res.reason).toContain('非承运商侧')
  })

  it('渠道侧（淘宝）演示实例桥接成功', async () => {
    const res = await bridge.resolveChannelAdapter(TENANT, PlatformKind.TAOBAO)
    expect(res.resolved).toBe(true)
    expect(res.adapterCode).toBe('taobao')
  })

  it('integrationStatus 全平台快照：真实 API 联调恒为 TODO，且凭证存在时承运商侧 wired=true', async () => {
    await credentials.setCredential(TENANT, PlatformKind.YUNEXPRESS, {
      appId: 'a',
      appKey: 'k',
      secret: 's',
    })
    const status = await bridge.integrationStatus(TENANT)
    // 平台数量与 PLATFORM_META 一致
    expect(status.length).toBeGreaterThanOrEqual(6)
    // honest：所有平台真实 API 联调均为 TODO
    expect(status.every((s) => s.realApiTodo === true)).toBe(true)
    // 凭证存在 → 云途 wired=true
    const yun = status.find((s) => s.platform === PlatformKind.YUNEXPRESS)
    expect(yun?.wired).toBe(true)
    expect(yun?.target).toBe('carrier')
    // mock 演示占位平台无桥接目标
    const mock = status.find((s) => s.platform === PlatformKind.MOCK)
    expect(mock?.target).toBe('none')
    expect(mock?.wired).toBe(false)
  })
})
