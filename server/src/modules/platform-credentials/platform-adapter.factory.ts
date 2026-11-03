/**
 * 平台适配器工厂（任务 NEXT-1，方案 §2.2/§3）。
 *
 * 「凭证工厂化接入」的核心：平台代码 → 客户端配置 / 适配器描述 的统一出口。
 * - describe(platform)：返回平台元信息（鉴权方式/能力/默认网关）。
 * - createClientConfig(platform, credential)：依据元数据补全默认网关，产出结构化客户端配置。
 * - resolveAdapter(platform, tenantId)：返回适配器描述符；真实适配器实例桥接
 *   承运商/渠道注册表（CarrierRegistryService / ChannelRegistryService）为 TODO（标注 scaffold-todo）。
 *
 * 诚实原则：本工厂当前只产出配置/描述符，不直接发起真实 HTTP 调用；真实联调在 TODO 处落地。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-29 夜间批次
 */

import { Injectable } from '@nestjs/common'
import { PlatformCredentialService } from './platform-credential.service'
import {
  PLATFORM_META,
  PlatformKind,
  PlatformMeta,
} from './platform-credentials.constants'

/** 平台适配器描述符（真实实例桥接前的轻量出口） */
export interface PlatformAdapterDescriptor {
  platform: PlatformKind
  label: string
  carrierSide: boolean
  capabilities: string[]
  /** scaffold-todo：真实适配器（经注册表桥接）待联调落地 */
  status: 'scaffold-todo'
  note: string
}

@Injectable()
export class PlatformAdapterFactory {
  constructor(private readonly credentials: PlatformCredentialService) {}

  /** 平台元信息（驱动前端表单/校验/能力展示） */
  describe(platform: PlatformKind): PlatformMeta {
    return PLATFORM_META[platform]
  }

  /** 产出客户端配置：补全默认网关，返回结构化配置对象 */
  createClientConfig<T extends Record<string, unknown>>(
    platform: PlatformKind,
    credential: T,
  ): T & { gateway?: string } {
    const meta = PLATFORM_META[platform]
    const gateway = (credential.gateway as string | undefined) ?? meta.defaultGateway
    return { ...credential, gateway }
  }

  /**
   * 解析适配器描述符。真实适配器实例应通过注册表桥接：
   * 承运商侧（carrierSide=true）→ CarrierRegistryService.resolveForAccount；
   * 渠道侧（carrierSide=false）→ ChannelRegistryService 解析渠道适配器。
   * 当前为 scaffold-todo，待真实 API 联调时在此注入对应注册表并实例化。
   */
  async resolveAdapter(platform: PlatformKind, tenantId: string): Promise<PlatformAdapterDescriptor> {
    const meta = PLATFORM_META[platform]
    const ok = await this.credentials.hasCredential(tenantId, platform)
    return {
      platform,
      label: meta.label,
      carrierSide: meta.carrierSide,
      capabilities: meta.capabilities,
      status: 'scaffold-todo',
      note: ok
        ? `凭证已就绪；真实适配器经${meta.carrierSide ? '承运商' : '渠道'}注册表桥接（TODO 联调）`
        : `凭证未配置；请先 setCredential(${platform})（TODO 联调）`,
    }
  }
}
