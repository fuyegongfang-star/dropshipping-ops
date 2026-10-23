/**
 * 供应商代发控制器（任务 1.9，方案 §21 供应商代发履约链路）。
 * 提供：供应商档案 CRUD、代发单（推单）创建与状态推进；全部按租户隔离（§0/§17）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { SuppliersService } from './suppliers.service'
import { CreateSupplierDto, CreateSupplierOrderDto, AdvanceSupplierOrderDto } from './dto/supplier.dto'

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly svc: SuppliersService) {}

  /** 供应商档案列表（租户隔离） */
  @Get()
  async listSuppliers(@TenantId() tenantId: string): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.listSuppliers(tenantId))
  }

  /** 新建供应商档案（§21） */
  @Post()
  async createSupplier(
    @TenantId() tenantId: string,
    @Body() body: CreateSupplierDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.createSupplier(tenantId, body.name))
  }

  /** 代发单列表（租户隔离，按创建倒序） */
  @Get('orders')
  async listOrders(@TenantId() tenantId: string): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.list(tenantId))
  }

  /** 新建代发单（推单，初始态 pushed，§21） */
  @Post('orders')
  async createOrder(
    @TenantId() tenantId: string,
    @Body() body: CreateSupplierOrderDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.create(tenantId, { supplierId: body.supplierId, orderId: body.orderId }))
  }

  /** 推进代发单状态（一步前进或直达 done，§21 状态机） */
  @Patch('orders/:id/advance')
  async advance(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: AdvanceSupplierOrderDto,
  ): Promise<ApiResponse<unknown>> {
    if (!tenantId) {
      throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    }
    return ok(await this.svc.advance(tenantId, id, body.to))
  }
}
