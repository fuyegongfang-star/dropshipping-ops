/**
 * 物流产品目录 / 费率卡服务（任务 4.6，方案 §4 / §23 运营配置后台）。
 * 负责物流产品的 CRUD（租户隔离）与费率卡成本试算。
 *
 * 费率卡成本 = 首重价 + 续重价 × max(0, 计费重kg − 1)（首重 1kg 内含）。
 * 计费重由调用方按抛比系数折算后传入（kg）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-16
 */

import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../database/prisma.service'
import { AppLogger } from '../../../common/logger/app.logger'
import {
  CreateLogisticsProductDto,
  UpdateLogisticsProductDto,
  LogisticsProductOut,
  RateCardQuote,
} from './logistics-product.types'

@Injectable()
export class LogisticsProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  /** 将 Prisma 记录映射为对外 DTO（Decimal → number，便于 JSON 序列化）。 */
  private toOut(row: Prisma.LogisticsProductGetPayload<null>): LogisticsProductOut {
    return {
      id: row.id,
      tenantId: row.tenantId,
      carrierCode: row.carrierCode,
      name: row.name,
      legType: row.legType,
      destZone: row.destZone,
      transitDaysMin: row.transitDaysMin,
      transitDaysMax: row.transitDaysMax,
      volumetricDivisor: row.volumetricDivisor,
      cargoTypeAllowed: row.cargoTypeAllowed,
      reachableCountries: row.reachableCountries,
      firstWeightPrice: Number(row.firstWeightPrice),
      additionalWeightPrice: Number(row.additionalWeightPrice),
      currency: row.currency,
      enabled: row.enabled,
      isDefault: row.isDefault,
      visible: row.visible,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  /** 列出当前租户的全部物流产品（按创建时间倒序）。 */
  async list(tenantId: string): Promise<LogisticsProductOut[]> {
    const rows = await this.prisma.logisticsProduct.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toOut(r))
  }

  /** 创建物流产品（绑定 tenantId）。 */
  async create(tenantId: string, dto: CreateLogisticsProductDto): Promise<LogisticsProductOut> {
    const row = await this.prisma.logisticsProduct.create({
      data: {
        tenantId,
        carrierCode: dto.carrierCode,
        name: dto.name,
        legType: dto.legType ?? 'direct',
        destZone: dto.destZone ?? 'ALL',
        transitDaysMin: dto.transitDaysMin ?? 3,
        transitDaysMax: dto.transitDaysMax ?? 7,
        volumetricDivisor: dto.volumetricDivisor ?? 5000,
        cargoTypeAllowed: dto.cargoTypeAllowed ?? 'normal',
        reachableCountries: dto.reachableCountries ?? '',
        firstWeightPrice: dto.firstWeightPrice ?? 0,
        additionalWeightPrice: dto.additionalWeightPrice ?? 0,
        currency: dto.currency ?? 'CNY',
        enabled: dto.enabled ?? true,
        isDefault: dto.isDefault ?? false,
        visible: dto.visible ?? true,
      },
    })
    this.logger.log(`创建物流产品 ${row.id}（${row.name}）`)
    return this.toOut(row)
  }

  /** 更新物流产品（需匹配 tenantId，防止跨租户越权）。 */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateLogisticsProductDto,
  ): Promise<LogisticsProductOut> {
    await this.requireOwned(tenantId, id)
    const row = await this.prisma.logisticsProduct.update({
      where: { id },
      data: {
        carrierCode: dto.carrierCode,
        name: dto.name,
        legType: dto.legType,
        destZone: dto.destZone,
        transitDaysMin: dto.transitDaysMin,
        transitDaysMax: dto.transitDaysMax,
        volumetricDivisor: dto.volumetricDivisor,
        cargoTypeAllowed: dto.cargoTypeAllowed,
        reachableCountries: dto.reachableCountries,
        firstWeightPrice: dto.firstWeightPrice,
        additionalWeightPrice: dto.additionalWeightPrice,
        currency: dto.currency,
        enabled: dto.enabled,
        isDefault: dto.isDefault,
        visible: dto.visible,
      },
    })
    return this.toOut(row)
  }

  /** 删除物流产品（需匹配 tenantId）。 */
  async remove(tenantId: string, id: string): Promise<{ deleted: boolean }> {
    await this.requireOwned(tenantId, id)
    await this.prisma.logisticsProduct.delete({ where: { id } })
    return { deleted: true }
  }

  /** 费率卡成本试算：首重价 + 续重价 × max(0, 计费重kg − 1)。 */
  async computeCarrierCost(
    productId: string,
    chargeableKg: number,
  ): Promise<RateCardQuote> {
    const row = await this.prisma.logisticsProduct.findUnique({ where: { id: productId } })
    if (!row) {
      throw new NotFoundException(`物流产品不存在：${productId}`)
    }
    const weight = Math.max(0, chargeableKg)
    const extra = Math.max(0, weight - 1) // 首重 1kg 内含
    const carrierCost =
      Number(row.firstWeightPrice) + Number(row.additionalWeightPrice) * extra
    return {
      productId: row.id,
      productName: row.name,
      carrierCode: row.carrierCode,
      weightKg: Number(weight.toFixed(3)),
      carrierCost: Number(carrierCost.toFixed(2)),
      currency: row.currency,
      transitDays: `${row.transitDaysMin}-${row.transitDaysMax}天`,
    }
  }

  /** 校验产品归属当前租户（防 IDOR / 跨租户改写）。 */
  private async requireOwned(tenantId: string, id: string): Promise<void> {
    const row = await this.prisma.logisticsProduct.findUnique({ where: { id } })
    if (!row) {
      throw new NotFoundException(`物流产品不存在：${id}`)
    }
    if (row.tenantId !== tenantId) {
      throw new NotFoundException(`物流产品不存在：${id}`)
    }
  }
}
