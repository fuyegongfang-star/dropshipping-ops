/**
 * 平台凭证管理控制器（任务 8.2，方案 §17.2 凭证工厂化接入）。
 *
 * 暴露 REST 能力，使前端「平台凭证管理」页（/platform-credentials）在正式模式下也能读写：
 * - GET    /platform-credentials        列出全部平台及其配置状态（不泄露明文密钥，仅给状态/更新时间）
 * - GET    /platform-credentials/:platform  解密返回某平台凭证字段（查看明文，需前端二次确认后调用）
 * - POST   /platform-credentials        写入/更新某平台凭证（明文入参 → 加密落库，绝不落明文）
 * - DELETE /platform-credentials/:platform  删除某平台凭证
 *
 * 租户隔离：所有操作经 @TenantId() 注入租户上下文，凭证以 tenantId 维度隔离（§0/§17）。
 * 桥接：写入成功后会经 PlatformAdapterFactory 解析适配器描述符（真实适配器经注册表桥接为 TODO），
 *       返回 binding 字段供前端展示「凭证 → 适配器就绪」状态，但不发起真实联网调用（诚实原则）。
 *
 * 负责人：自动开发引擎 ｜ 新增于 2026-10-30 夜间批次（8.2）
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { PlatformCredentialService } from './platform-credential.service'
import { PlatformAdapterFactory, type PlatformAdapterDescriptor } from './platform-adapter.factory'
import { PlatformIntegrationBridgeService, type PlatformBridgeStatus } from './integration-bridge.service'
import { PLATFORM_META, PlatformKind } from './platform-credentials.constants'
import { SaveCredentialDto } from './dtos/save-credential.dto'

/** 凭证列表项（脱敏，不返回明文） */
export interface CredentialListItem {
  platform: PlatformKind
  label: string
  authType: string
  carrierSide: boolean
  capabilities: string[]
  status: 'configured' | 'empty'
  updatedAt?: string
}

/** 解密后的凭证明细（查看明文用） */
export interface CredentialDetail {
  platform: PlatformKind
  fields: Record<string, string>
}

/** 写入后的回执（含桥接状态） */
export interface CredentialSaveResult {
  platform: PlatformKind
  status: 'configured'
  binding: PlatformAdapterDescriptor
}

@Controller('platform-credentials')
export class PlatformCredentialsController {
  constructor(
    private readonly credentials: PlatformCredentialService,
    private readonly factory: PlatformAdapterFactory,
    private readonly bridge: PlatformIntegrationBridgeService,
  ) {}

  /** 列出全部平台及其配置状态（脱敏，供网格卡片渲染） */
  @Get()
  async list(@TenantId() tenantId: string): Promise<ApiResponse<CredentialListItem[]>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    const list: CredentialListItem[] = (Object.keys(PLATFORM_META) as PlatformKind[]).map((p) => {
      const meta = PLATFORM_META[p]
      const stored = this.credentials.hasCredential(tenantId, p)
      return {
        platform: p,
        label: meta.label,
        authType: meta.authType,
        carrierSide: meta.carrierSide,
        capabilities: meta.capabilities,
        status: stored ? 'configured' : 'empty',
        updatedAt: stored ? this.credentials.getUpdatedAt(tenantId, p) : undefined,
      }
    })
    return ok(list)
  }

  /**
   * 集成桥接状态快照（任务 10.1）：返回各平台凭证 → 适配器注册表的桥接就绪情况。
   * 前端「平台凭证管理」页据此渲染「已桥接 / 待联调 / 未配置」徽章；真实 API 联调统一标记 TODO。
   */
  @Get('integration')
  async integration(
    @TenantId() tenantId: string,
  ): Promise<ApiResponse<PlatformBridgeStatus[]>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(this.bridge.integrationStatus(tenantId))
  }

  /** 解密返回某平台凭证字段（明文仅在此接口出现，前端查看需二次确认） */
  @Get(':platform')
  async get(
    @TenantId() tenantId: string,
    @Param('platform') platform: PlatformKind,
  ): Promise<ApiResponse<CredentialDetail>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    if (!PLATFORM_META[platform]) {
      throw new BusinessException('PLATFORM_UNKNOWN', `未知平台 ${platform}`, HttpStatus.BAD_REQUEST)
    }
    const fields = this.credentials.getCredential<Record<string, string>>(tenantId, platform)
    return ok({ platform, fields })
  }

  /** 写入/更新凭证（明文入参，服务层加密落库） */
  @Post()
  async save(
    @TenantId() tenantId: string,
    @Body() dto: SaveCredentialDto,
  ): Promise<ApiResponse<CredentialSaveResult>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    if (!PLATFORM_META[dto.platform]) {
      throw new BusinessException('PLATFORM_UNKNOWN', `未知平台 ${dto.platform}`, HttpStatus.BAD_REQUEST)
    }
    this.credentials.setCredential(tenantId, dto.platform, dto.fields)
    // 桥接：解析适配器描述符（真实实例经承运商/渠道注册表桥接为 TODO，不联网）
    const binding = this.factory.resolveAdapter(dto.platform, tenantId)
    return ok(
      { platform: dto.platform, status: 'configured', binding },
      `平台 ${PLATFORM_META[dto.platform].label} 凭证已保存`,
    )
  }

  /** 删除凭证 */
  @Delete(':platform')
  async remove(
    @TenantId() tenantId: string,
    @Param('platform') platform: PlatformKind,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    if (!PLATFORM_META[platform]) {
      throw new BusinessException('PLATFORM_UNKNOWN', `未知平台 ${platform}`, HttpStatus.BAD_REQUEST)
    }
    this.credentials.removeCredential(tenantId, platform)
    return ok({ deleted: true }, `平台 ${PLATFORM_META[platform].label} 凭证已删除`)
  }
}
