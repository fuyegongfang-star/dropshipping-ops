/**
 * 店铺（渠道）控制器（配套前端「渠道中心」可视化，任务 6.1）。
 * 提供：租户隔离的店铺列表（§3）+ 新增绑定（POST）+ 解绑（DELETE）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-11 ｜ 最后修订：2026-10-24
 */

import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { HttpStatus } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ShopsService } from './shops.service'
import { CreateShopDto } from './dto/create-shop.dto'

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

  /** 新增店铺（渠道绑定，租户隔离） */
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateShopDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.create(tenantId, dto), '店铺已绑定')
  }

  /** 解绑店铺（校验归属，防 IDOR） */
  @Delete(':id')
  async remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.remove(tenantId, id), '店铺已解绑')
  }
}
