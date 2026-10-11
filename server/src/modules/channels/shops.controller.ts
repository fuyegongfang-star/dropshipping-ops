/**
 * 店铺（渠道）读取控制器（配套前端「渠道中心」可视化）。
 * 提供：租户隔离的店铺列表（渠道来源）。拉单入口见 ChannelSyncController。
 *
 * 负责人：人工补开发（可视化闭环）｜ 创建：2026-10-11
 */

import { Controller, Get } from '@nestjs/common'
import { HttpStatus } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ShopsService } from './shops.service'

@Controller('shops')
export class ShopsController {
  constructor(private readonly svc: ShopsService) {}

  /** 店铺列表（租户隔离） */
  @Get()
  async list(@TenantId() tenantId: string): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.list(tenantId))
  }
}
