/**
 * 物流回传与轨迹控制器（任务 1.6，方案 §3 推单回传 / §6 轨迹与异常）。
 * 暴露：建单 / 回传平台 / 轨迹上报 / 轨迹查询 / 运单列表。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-22
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ShipmentsService } from './shipments.service'
import { BookShipmentDto, RecordTrackingDto, ShipmentVo, TrackingVo } from './shipment.types'

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly svc: ShipmentsService) {}

  /** 为订单建单：向承运商下单并落库运单 + 首条轨迹（§3 createShipment） */
  @Post()
  async book(
    @TenantId() tenantId: string,
    @Body() dto: BookShipmentDto,
  ): Promise<ApiResponse<ShipmentVo>> {
    return ok(await this.svc.book(dto, tenantId))
  }

  /** 推单回传：将运单号回写销售渠道，推进订单至 pushed（§3 推单回传） */
  @Post(':id/fulfill')
  async fulfill(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return ok(await this.svc.fulfill(id, tenantId))
  }

  /** 上报轨迹节点（Webhook/轮询入口，§6 基础轨迹） */
  @Post(':id/tracking')
  async recordTracking(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: RecordTrackingDto,
  ): Promise<ApiResponse<TrackingVo>> {
    return ok(await this.svc.recordTracking({ ...dto, shipmentId: id }, tenantId))
  }

  /** 查询运单轨迹时间线（按发生时间升序，§6） */
  @Get(':id/tracking')
  async listTracking(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<TrackingVo[]>> {
    return ok(await this.svc.listTracking(id, tenantId))
  }

  /** 运单列表（可按订单过滤，§17 租户隔离） */
  @Get()
  async list(
    @TenantId() tenantId: string,
    @Query('orderId') orderId?: string,
  ): Promise<ApiResponse<ShipmentVo[]>> {
    return ok(await this.svc.list(tenantId, orderId))
  }
}
