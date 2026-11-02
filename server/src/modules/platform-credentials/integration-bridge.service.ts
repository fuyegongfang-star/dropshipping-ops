/**
 * 平台凭证 ↔ 适配器注册表 桥接服务（任务 10.1，方案 §17.2 / §2.2 / §3）。
 *
 * 这是「真实平台凭证联调桥接」的核心落地：把「凭证工厂」已加密存储的凭证，
 * 经各自注册表桥接为**真实适配器实例**，使后续真实 API 联调（2026-11 排期）可直接复用。
 *
 * 诚实原则：本服务只完成「凭证 → 适配器实例」的装配与可达性判定，**绝不发起真实联网调用**；
 * 各适配器内部真实 HTTP 端点/字段仍为合理占位（TODO(ops): 2026-11 联调校正），
 * 因此 integrationStatus 一律 `realApiTodo=true`，直到真实联调完成并验收。
 *
 * 桥接映射：
 * - 承运商侧（carrierSide=true）：yunexpress/dhl/fourpx/yanwen → 对应 CarrierCode，经 CarrierRegistryService 工厂构建。
 * - 渠道侧（carrierSide=false）：taobao/douyin → 对应 ChannelPlatform，经 ChannelRegistryService 取已注册实例
 *   （淘宝/抖音当前为演示实例；Shopify/Amazon 为店铺级凭证，按店铺维度桥接，超出平台凭证范畴，见 TODO）。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-11-02 夜间批次（10.1 收尾桥接）
 */

import { Injectable } from '@nestjs/common'
import { CarrierAdapter } from '../carriers/carrier-adapter.interface'
import { CarrierCode } from '../carriers/carrier.constants'
import { CarrierAccountContext, CarrierRegistryService } from '../carriers/carrier-registry.service'
import { ChannelAdapter } from '../channels/channel-adapter.interface'
import { ChannelPlatform } from '../channels/channel.constants'
import { ChannelRegistryService } from '../channels/channel-registry.service'
import { PlatformCredentialService } from './platform-credential.service'
import { PLATFORM_META, PlatformKind } from './platform-credentials.constants'

/** 平台 → 承运商代码映射（仅承运商侧真实平台，mock 不入桥接） */
const PLATFORM_TO_CARRIER: Partial<Record<PlatformKind, CarrierCode>> = {
  [PlatformKind.YUNEXPRESS]: CarrierCode.YUNEXPRESS,
  [PlatformKind.DHL]: CarrierCode.DHL,
  [PlatformKind.FOURPX]: CarrierCode.FOURPX,
  [PlatformKind.YANWEN]: CarrierCode.YANWEN,
}

/** 平台 → 渠道平台映射（渠道侧真实平台；Shopify/Amazon 为店铺级，未纳入平台凭证桥接） */
const PLATFORM_TO_CHANNEL: Partial<Record<PlatformKind, ChannelPlatform>> = {
  [PlatformKind.TAOBAO]: ChannelPlatform.TAOBAO,
  [PlatformKind.DOUYIN]: ChannelPlatform.DOUYIN,
}

/** 适配器解析结果（统一出口，便于控制器/前端判定桥接是否就绪） */
export interface AdapterResolution {
  resolved: boolean
  adapter?: CarrierAdapter | ChannelAdapter
  adapterCode?: string
  reason: string
}

/** 单平台桥接状态（integrationStatus 元素） */
export interface PlatformBridgeStatus {
  platform: PlatformKind
  label: string
  carrierSide: boolean
  hasCredential: boolean
  /** 适配器已通过注册表桥接（凭证 → 实例） */
  wired: boolean
  /** 桥接目标端：carrier=承运商注册表 / channel=渠道注册表 / none=无桥接目标 */
  target: 'carrier' | 'channel' | 'none'
  adapterCode?: string
  reason: string
  /** 真实联网 API 调用是否仍待联调（诚实标注，当前全部 true） */
  realApiTodo: boolean
}

@Injectable()
export class PlatformIntegrationBridgeService {
  constructor(
    private readonly credentials: PlatformCredentialService,
    private readonly carrierRegistry: CarrierRegistryService,
    private readonly channelRegistry: ChannelRegistryService,
  ) {}

  /**
   * 按平台 + 租户解析承运商适配器实例。
   * 仅当：① 平台为承运商侧；② 已配置凭证；③ 注册表存在对应工厂 时，才返回真实实例；
   * 否则返回 resolved=false 并给出人类可读原因（不抛异常，优雅降级）。
   */
  resolveCarrierAdapter(tenantId: string, platform: PlatformKind): AdapterResolution {
    const carrierCode = PLATFORM_TO_CARRIER[platform]
    if (!carrierCode) {
      return { resolved: false, reason: '该平台非承运商侧，无承运商适配器可桥接' }
    }
    if (!this.credentials.hasCredential(tenantId, platform)) {
      return { resolved: false, reason: '未配置平台凭证，无法桥接承运商适配器（请先 setCredential）' }
    }
    try {
      const authConfig = this.credentials.getCredential<Record<string, unknown>>(tenantId, platform)
      const context: CarrierAccountContext = {
        id: `${tenantId}:${platform}`,
        tenantId,
        carrierCode,
        authConfig,
      }
      const adapter = this.carrierRegistry.resolveForAccount(context)
      return {
        resolved: true,
        adapter,
        adapterCode: carrierCode,
        reason: `已桥接承运商适配器 ${carrierCode}（凭证经注册表工厂注入 authConfig）`,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { resolved: false, reason: `承运商适配器构建失败：${msg}` }
    }
  }

  /**
   * 按平台 + 租户解析渠道适配器实例。
   * 淘宝/抖音为已注册演示实例（无需店铺级凭证）；Shopify/Amazon 为店铺级，超出平台凭证范畴 → 诚实标注 TODO。
   */
  resolveChannelAdapter(tenantId: string, platform: PlatformKind): AdapterResolution {
    const channelPlatform = PLATFORM_TO_CHANNEL[platform]
    if (!channelPlatform) {
      return { resolved: false, reason: '该平台非渠道侧，无渠道适配器可桥接' }
    }
    try {
      // 淘宝/抖音当前为无状态演示实例；真实店铺级 OAuth 联调（Shopify/Amazon）为 TODO。
      const adapter = this.channelRegistry.getAdapter(channelPlatform)
      return {
        resolved: true,
        adapter,
        adapterCode: channelPlatform,
        reason: `已桥接渠道适配器 ${channelPlatform}（演示实例；真实店铺级 OAuth 联调 TODO）`,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { resolved: false, reason: `渠道适配器获取失败：${msg}` }
    }
  }

  /** 全平台桥接状态快照（驱动前端「集成桥接」徽章 + 后端联调进度追踪） */
  integrationStatus(tenantId: string): PlatformBridgeStatus[] {
    return (Object.keys(PLATFORM_META) as PlatformKind[]).map((platform) => {
      const meta = PLATFORM_META[platform]
      const hasCredential = this.credentials.hasCredential(tenantId, platform)
      const carrierCode = PLATFORM_TO_CARRIER[platform]
      const channelPlatform = PLATFORM_TO_CHANNEL[platform]

      let target: PlatformBridgeStatus['target'] = 'none'
      let wired = false
      let adapterCode: string | undefined
      let reason = '无桥接目标（演示占位平台）'

      if (carrierCode) {
        target = 'carrier'
        const res = this.resolveCarrierAdapter(tenantId, platform)
        wired = res.resolved
        adapterCode = res.adapterCode
        reason = res.reason
      } else if (channelPlatform) {
        target = 'channel'
        const res = this.resolveChannelAdapter(tenantId, platform)
        wired = res.resolved
        adapterCode = res.adapterCode
        reason = res.reason
      }

      return {
        platform,
        label: meta.label,
        carrierSide: meta.carrierSide,
        hasCredential,
        wired,
        target,
        adapterCode,
        reason,
        realApiTodo: true, // 诚实：真实联网端点/字段待 2026-11 联调校正
      }
    })
  }
}
