/**
 * 承运商控制器（任务 3.1 框架 REST 入口，方案 §3）。
 * 暴露：承运商目录、健康检查、比价、建单、轨迹、取消、订阅。
 * 与 ChannelSyncController 对称，便于前端「承运商中心 / 试算门户（§4.7）」可视化接入。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiResponse, ok } from '../../common/response/api-response'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { CarriersService } from './carriers.service'
import { CarrierCode } from './carrier.constants'
import { GetRatesRequest } from './dto/rate.dto'
import { CreateShipmentRequest } from './dto/shipment.dto'

@Controller('carriers')
export class CarriersController {
  constructor(private readonly svc: CarriersService) {}

  /** 承运商目录（运营级，全局） */
  @Get()
  async list(): Promise<ApiResponse<unknown>> {
    return ok(await this.svc.listCatalog())
  }

  /** 承运商健康/能力探测 */
  @Get(':code/health')
  async health(@Param('code') code: string): Promise<ApiResponse<unknown>> {
    return ok(await this.svc.health(code as CarrierCode))
  }

  /** 比价/运费试算（§4） */
  @Post(':code/rates')
  async rates(
    @TenantId() tenantId: string,
    @Param('code') code: string,
    @Body() req: GetRatesRequest,
  ): Promise<ApiResponse<unknown>> {
    return ok(await this.svc.quote(tenantId, code as CarrierCode, req))
  }

  /** 建单/推单（§3 createShipment） */
  @Post(':code/shipments')
  async ship(
    @TenantId() tenantId: string,
    @Param('code') code: string,
    @Body() req: CreateShipmentRequest,
  ): Promise<ApiResponse<unknown>> {
    return ok(await this.svc.ship(tenantId, code as CarrierCode, req))
  }

  /** 轨迹查询（§3/§6） */
  @Get(':code/tracking/:no')
  async track(@Param('code') code: string, @Param('no') no: string): Promise<ApiResponse<unknown>> {
    return ok(await this.svc.track(code as CarrierCode, no))
  }

  /** 取消运单（§13.2 逆向） */
  @Post(':code/cancel/:no')
  async cancel(@Param('code') code: string, @Param('no') no: string): Promise<ApiResponse<unknown>> {
    await this.svc.cancel(code as CarrierCode, no)
    return ok({ cancelled: no })
  }

  /** 轨迹订阅（云途类推送，§6 双通道） */
  @Post(':code/subscribe/:no')
  async subscribe(
    @Param('code') code: string,
    @Param('no') no: string,
  ): Promise<ApiResponse<unknown>> {
    await this.svc.subscribe(code as CarrierCode, no)
    return ok({ subscribed: no })
  }
}
