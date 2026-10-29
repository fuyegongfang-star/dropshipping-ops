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
  LinkPurchaseOrderDto,
  UpdatePurchaseOrderBoxCountDto,
  UpdatePurchaseOrderStatusDto,
} from './dto/purchase-order.dto'

@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly svc: PurchaseOrderService) {}

  /** 采购单列表（租户隔离），可按 status / shopId / orderId 过滤 */
  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('shopId') shopId?: string,
    @Query('orderId') orderId?: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.list(tenantId, { status, shopId, orderId }))
  }

  /** 候选店铺订单 + 命中理由（6.4 匹配预览） */
  @Get(':id/candidates')
  async candidates(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.findCandidates(tenantId, id))
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

  /** 7.2 收货标签数据：供应商贴箱 → 中转仓一枪到货（含箱数、行项 SKU/品名/数量） */
  @Get(':id/label-data')
  async labelData(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.getLabelData(tenantId, id))
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

  /** 6.4 自动匹配：取最强命中候选并关联店铺订单 */
  @Post(':id/auto-match')
  async autoMatch(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.autoMatch(tenantId, id))
  }

  /** 6.4 手动关联店铺订单 */
  @Post(':id/link')
  async link(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: LinkPurchaseOrderDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.link(tenantId, id, dto.orderId), '已关联店铺订单')
  }

  /** 6.4 解除关联 */
  @Post(':id/unlink')
  async unlink(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.unlink(tenantId, id), '已解除关联')
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

  /** 7.2 更新收货标签箱数（供应商贴箱数，A4/热敏拼版用） */
  @Patch(':id')
  async updateBoxCount(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderBoxCountDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.updateBoxCount(tenantId, id, dto.boxCount), '收货标签箱数已更新')
  }
}
