/**
 * 承运商服务（任务 3.1 框架 REST 支撑）。
 * 职责：① 读取承运商目录（Carrier 表，运营维护）；② 经注册表分发适配器执行
 *      健康检查/比价/建单/轨迹/取消/订阅。
 * 多租户：目录为运营级（全局），账号（CarrierAccount）按租户隔离（§2.2）。
 * 工厂型承运商（需账号凭证，如云途/DHL）在 3.2+ 注册工厂后，本服务按租户查账号构建实例。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { BusinessException } from '../../common/response/business.exception'
import { PrismaService } from '../../database/prisma.service'
import { CarrierRegistryService } from './carrier-registry.service'
import { CarrierCode, CarrierHealth } from './carrier.constants'
import { CarrierAdapter } from './carrier-adapter.interface'
import { GetRatesRequest, RateQuote } from './dto/rate.dto'
import { CreateShipmentRequest, CreateShipmentResult } from './dto/shipment.dto'
import { CarrierTrackingResult } from './dto/tracking.dto'

/** 承运商目录条目（运营维护的 Carrier 表投影） */
export interface CarrierCatalogItem {
  code: string
  name: string
  authType: string
}

@Injectable()
export class CarriersService {
  constructor(
    private readonly registry: CarrierRegistryService,
    private readonly prisma: PrismaService,
  ) {}

  /** 承运商目录（运营维护的 Carrier 表；无记录时回退枚举清单，保证前端有可选项） */
  async listCatalog(): Promise<CarrierCatalogItem[]> {
    const carriers = await this.prisma.carrier.findMany({ orderBy: { code: 'asc' } })
    if (carriers.length > 0) {
      return carriers.map((c) => ({ code: c.code, name: c.name, authType: c.authType }))
    }
    return Object.values(CarrierCode).map((code) => ({
      code,
      name: this.defaultName(code),
      authType: 'unknown',
    }))
  }

  /** 承运商健康/能力探测（按 code 取无状态实例；工厂型用探针账号构建仅取能力声明，不真实探测） */
  async health(code: CarrierCode): Promise<CarrierHealth> {
    if (!this.registry.has(code)) {
      return { healthy: false, message: `适配器未注册: ${code}（工厂型或尚未实现，任务 3.2+）` }
    }
    try {
      // 工厂型（需账号凭证）以探针账号构建实例，仅读取能力声明（healthCheck 无网络探测）
      const adapter = this.registry.isFactory(code)
        ? this.registry.resolveForAccount({
            id: '__probe__',
            tenantId: '__probe__',
            carrierCode: code,
            authConfig: {},
          })
        : this.registry.getAdapter(code)
      return await adapter.healthCheck()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { healthy: false, message: `适配器初始化失败: ${msg}` }
    }
  }

  /** 比价：解析适配器 → getRates */
  async quote(tenantId: string, code: CarrierCode, req: GetRatesRequest): Promise<RateQuote[]> {
    return (await this.resolve(tenantId, code)).getRates(req)
  }

  /** 建单：解析适配器 → createShipment */
  async ship(
    tenantId: string,
    code: CarrierCode,
    req: CreateShipmentRequest,
  ): Promise<CreateShipmentResult> {
    return (await this.resolve(tenantId, code)).createShipment(req)
  }

  /** 轨迹：实例型适配器 → getTracking（工厂型待 3.2+ 落地账号解析） */
  async track(code: CarrierCode, trackingNo: string): Promise<CarrierTrackingResult> {
    return this.registry.getAdapter(code).getTracking(trackingNo)
  }

  /** 取消运单 */
  async cancel(code: CarrierCode, no: string): Promise<void> {
    await this.registry.getAdapter(code).cancelShipment(no)
  }

  /** 订阅轨迹 */
  async subscribe(code: CarrierCode, no: string): Promise<void> {
    await this.registry.getAdapter(code).subscribeTracking(no)
  }

  /**
   * 解析适配器：工厂型（需账号凭证，§2.2）优先查租户 CarrierAccount 后用工厂构建；
   * 无状态实例（如 MOCK）直接取；均未注册则抛业务异常（优雅失败）。
   */
  private async resolve(tenantId: string, code: CarrierCode): Promise<CarrierAdapter> {
    if (this.registry.isFactory(code)) {
      return this.buildFromAccount(tenantId, code)
    }
    return this.registry.getAdapter(code)
  }

  /** 对外暴露：供比价引擎（§5）按租户解析适配器（工厂型无账号时抛错，由引擎捕获跳过） */
  async resolveAdapter(tenantId: string, code: CarrierCode): Promise<CarrierAdapter> {
    return this.resolve(tenantId, code)
  }

  /** 工厂型：查租户承运商账号并用工厂构建实例（§2.2） */
  private async buildFromAccount(tenantId: string, code: CarrierCode): Promise<CarrierAdapter> {
    const carrier = await this.prisma.carrier.findUnique({ where: { code } })
    if (!carrier) {
      throw new BusinessException(
        'CARRIER_NOT_FOUND',
        `承运商目录缺失: ${code}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const account = await this.prisma.carrierAccount.findFirst({
      where: { tenantId, carrierId: carrier.id },
    })
    if (!account) {
      throw new BusinessException(
        'CARRIER_ACCOUNT_MISSING',
        `租户 ${tenantId} 未配置承运商 ${code} 账号`,
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.registry.resolveForAccount({
      id: account.id,
      tenantId,
      carrierCode: code,
      authConfig: account.credentials,
    })
  }

  /** 内置承运商中文名（目录无数据时回退） */
  private defaultName(code: CarrierCode): string {
    const map: Record<CarrierCode, string> = {
      [CarrierCode.YUNEXPRESS]: '云途 YunExpress',
      [CarrierCode.DHL]: 'DHL Express',
      [CarrierCode.FOURPX]: '递四方 4PX',
      [CarrierCode.YANWEN]: '燕文 Yanwen',
      [CarrierCode.AGGREGATOR]: '聚合平台兜底',
      [CarrierCode.MOCK]: 'Mock 承运商',
    }
    return map[code]
  }
}
