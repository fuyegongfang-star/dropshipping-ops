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
import { ShipmentLegsService, ComposeShipmentRequest } from './shipment-legs.service'
import { LabelService } from './label/label.service'
import { LabelSpec } from './label/label.types'
import { CustomsService } from './customs/customs.service'
import { CustomsSpec } from './customs/customs.types'
import { TrackingService } from './tracking/tracking.service'
import { TrackingQuery } from './tracking/tracking.types'
import { CarrierCode } from './carrier.constants'
import { GetRatesRequest } from './dto/rate.dto'
import { CreateShipmentRequest } from './dto/shipment.dto'

@Controller('carriers')
export class CarriersController {
  constructor(
    private readonly svc: CarriersService,
    private readonly legs: ShipmentLegsService,
    private readonly label: LabelService,
    private readonly customs: CustomsService,
    private readonly tracking: TrackingService,
  ) {}

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

  /** 两段式运单编排（§14 头程/尾程）：拆分 first + last 两段分别建单并聚合 */
  @Post('shipments/compose')
  async compose(
    @TenantId() tenantId: string,
    @Body() req: ComposeShipmentRequest,
  ): Promise<ApiResponse<unknown>> {
    return ok(await this.legs.compose(tenantId, req))
  }

  /** 面单渲染（§3/§11）：把一段运单渲染为 PDF（pdf-lib）+ ZPL（热敏）双格式 */
  @Post('labels')
  async labels(@Body() spec: LabelSpec): Promise<ApiResponse<unknown>> {
    return ok(await this.label.build(spec))
  }

  /** 报关/合规校验（§19 守卫）：booking 前关卡，失败阻断或转人工 */
  @Post('customs/validate')
  async customsValidate(@Body() spec: CustomsSpec): Promise<ApiResponse<unknown>> {
    return ok(await this.customs.validate(spec))
  }

  /** 轨迹双通道 + NDR（§3/§6/§20）：推送优先，轮询兜底，异常自动识别 */
  @Post('tracking/query')
  async trackingQuery(@TenantId() tenantId: string, @Body() q: TrackingQuery): Promise<ApiResponse<unknown>> {
    return ok(await this.tracking.track(tenantId, q.carrierCode as CarrierCode, q.trackingNo))
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
