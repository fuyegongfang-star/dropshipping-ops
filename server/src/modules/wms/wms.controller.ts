/**
 * WMS 控制器（任务 2.2/2.3，方案 §15 海外仓与一件代发）。
 * 提供：仓库(国内/海外)、入库预报(ASN)、上架、库存调整、拣货波次；全部按租户隔离。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { WmsService } from './wms.service'
import {
  CreateWarehouseDto,
  CreateAsnDto,
  PutawayDto,
  AdjustInventoryDto,
  CreateWaveDto,
} from './wms.dto'

@Controller('wms')
export class WmsController {
  constructor(private readonly wms: WmsService) {}

  /** 仓库列表（租户隔离，国内/海外） */
  @Get('warehouses')
  async listWarehouses(@TenantId() tenantId: string): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.listWarehouses(tenantId))
  }

  /** 新建仓库 */
  @Post('warehouses')
  async createWarehouse(@TenantId() tenantId: string, @Body() body: CreateWarehouseDto): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.createWarehouse(tenantId, body))
  }

  /** 入库单(ASN)列表（可按仓库过滤） */
  @Get('asns')
  async listAsns(@TenantId() tenantId: string, @Query('warehouseId') warehouseId?: string): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.listAsns(tenantId, warehouseId))
  }

  /** 新建入库预报(ASN) */
  @Post('asns')
  async createAsn(@TenantId() tenantId: string, @Body() body: CreateAsnDto): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.createAsn(tenantId, body))
  }

  /** 收货质检：ASN pending → received */
  @Post('asns/:id/receive')
  async receiveAsn(@TenantId() tenantId: string, @Param('id') id: string): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.receiveAsn(tenantId, id))
  }

  /** 上架：收货实物入到库位并增加库存 */
  @Post('asns/:id/putaway')
  async putaway(@TenantId() tenantId: string, @Param('id') id: string, @Body() body: PutawayDto): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.putaway(tenantId, id, body))
  }

  /** 库存列表（可按仓库过滤） */
  @Get('inventory')
  async listInventory(@TenantId() tenantId: string, @Query('warehouseId') warehouseId?: string): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.listInventory(tenantId, warehouseId))
  }

  /** 库存调整（入库 / 出库 / 盘点损益） */
  @Post('inventory/adjust')
  async adjustInventory(@TenantId() tenantId: string, @Body() body: AdjustInventoryDto): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.adjustInventory(tenantId, body))
  }

  /** 拣货任务列表（可按仓库过滤） */
  @Get('picks')
  async listPicks(@TenantId() tenantId: string, @Query('warehouseId') warehouseId?: string): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.listPicks(tenantId, warehouseId))
  }

  /** 创建拣货波次（按订单生成拣货任务） */
  @Post('pick/wave')
  async createWave(@TenantId() tenantId: string, @Body() body: CreateWaveDto): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.createWave(tenantId, body))
  }

  /** 完成拣货任务 */
  @Post('picks/:id/complete')
  async completePick(@TenantId() tenantId: string, @Param('id') id: string): Promise<ApiResponse<unknown>> {
    return ok(await this.wms.completePick(tenantId, id))
  }
}
