/**
 * 采购单控制器（任务 6.2，方案 §21 衍生 / 阶段6 中转仓作业流）。
 * 提供：采购单列表（GET）/ 新增（POST）/ 状态推进（PATCH）；全链路租户隔离（§0/§17）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-24
 */

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { HttpStatus } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { PurchaseOrderService } from './purchase-order.service'
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderStatusDto,
} from './dto/purchase-order.dto'

@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly svc: PurchaseOrderService) {}

  /** 采购单列表（租户隔离），可按 status / shopId 过滤 */
  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('shopId') shopId?: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.list(tenantId, { status, shopId }))
  }

  /** 采购单详情（租户隔离） */
  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.getById(tenantId, id))
  }

  /** 新增采购单（含行项，租户隔离） */
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.create(tenantId, dto), '采购单已创建')
  }

  /** 推进采购单状态（校验状态机，§6） */
  @Patch(':id/status')
  async updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.updateStatus(tenantId, id, dto), '采购单状态已更新')
  }
}
