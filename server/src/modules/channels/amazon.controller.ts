/**
 * Amazon SP-API 操作控制器（方案 §29 完整对接的可视化/REST 入口）。
 * 按店铺（仅 Amazon 平台）暴露：连接健康、FBA Inbound 头程入仓、Shipping 买运单、Reports 对账。
 * 租户隔离：校验店铺归属当前租户（@TenantId），避免跨租户访问（§17）。
 * 适配器经 AmazonAdapterFactory 由店铺 authConfig 构建（含 SigV4 签名器选择，§29）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-20
 */

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { HttpStatus } from '@nestjs/common'
import { ok } from '../../common/response/api-response'
import { BusinessException } from '../../common/response/business.exception'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { PrismaService } from '../../database/prisma.service'
import { AmazonAdapterFactory } from './adapters/amazon/amazon-adapter'
import { AmazonAdapter } from './adapters/amazon/amazon-adapter'

/** FBA 入库计划请求体 */
interface FbaPlanBody {
  items: Array<{ sellerSku: string; quantity: number }>
  shipFromAddress?: Record<string, string>
  labelPrepPreference?: 'SELLER_LABEL' | 'AMAZON_LABEL'
}
/** FBA 建仓请求体 */
interface FbaCreateBody {
  shipmentName: string
  plan: {
    shipmentPlanId: string
    destinationFulfillmentCenterId: string
    items: Array<{ sellerSku: string; quantity: number; fulfillmentNetworkSku: string }>
  }
  shipFromAddress?: Record<string, string>
}
/** Shipping 购单请求体 */
interface ShippingLabelBody {
  amazonOrderId: string
  items: Array<{ sellerSku: string; quantity: number }>
  shipFromAddress?: Record<string, string>
}
/** Reports 请求体 */
interface ReportBody {
  reportType: string
  dataStartTime?: string
  dataEndTime?: string
}

@Controller('amazon')
export class AmazonController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly factory: AmazonAdapterFactory,
  ) {}

  /** 解析并校验 Amazon 店铺，构建适配器（租户隔离） */
  private async resolveAdapter(shopId: string, tenantId: string): Promise<AmazonAdapter> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, tenantId: true, platform: true, authConfig: true },
    })
    if (!shop) {
      throw new BusinessException('SHOP_NOT_FOUND', '店铺不存在', HttpStatus.NOT_FOUND)
    }
    if (shop.tenantId !== tenantId) {
      throw new BusinessException('TENANT_MISMATCH', '店铺不属于当前租户', HttpStatus.FORBIDDEN)
    }
    if (shop.platform !== 'amazon') {
      throw new BusinessException('NOT_AMAZON_SHOP', '该店铺非 Amazon 平台', HttpStatus.BAD_REQUEST)
    }
    return this.factory.build({
      id: shop.id,
      tenantId: shop.tenantId,
      platform: shop.platform,
      authConfig: shop.authConfig,
    })
  }

  /** 连接健康：LWA 令牌 + SP-API 区域可达性代理 */
  @Get(':shopId/health')
  async health(@Param('shopId') shopId: string, @TenantId() tenantId: string) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(await adapter.healthCheck())
  }

  /** FBA 入库计划（头程入仓：分配目的 FBA 仓） */
  @Post(':shopId/fba-inbound/plan')
  async fbaPlan(@Param('shopId') shopId: string, @TenantId() tenantId: string, @Body() body: FbaPlanBody) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(
      await adapter.createInboundShipmentPlan({
        items: body.items,
        shipFromAddress: body.shipFromAddress ?? {},
        labelPrepPreference: body.labelPrepPreference,
      }),
    )
  }

  /** FBA 建仓：按入库计划创建实际货件 */
  @Post(':shopId/fba-inbound')
  async fbaCreate(@Param('shopId') shopId: string, @TenantId() tenantId: string, @Body() body: FbaCreateBody) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(
      await adapter.createInboundShipment({
        shipmentName: body.shipmentName,
        plan: body.plan,
        shipFromAddress: body.shipFromAddress ?? {},
      }),
    )
  }

  /** FBA 货件查询 */
  @Get(':shopId/fba-inbound/:shipmentId')
  async fbaGet(
    @Param('shopId') shopId: string,
    @Param('shipmentId') shipmentId: string,
    @TenantId() tenantId: string,
  ) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(await adapter.getInboundShipment(shipmentId))
  }

  /** FBA 预处理指引 */
  @Get(':shopId/fba-inbound/prep')
  async fbaPrep(@Param('shopId') shopId: string, @TenantId() tenantId: string, @Query('skus') skus: string) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    const list = skus ? skus.split(',').map((s) => s.trim()).filter(Boolean) : []
    return ok(await adapter.getPrepInstructions(list))
  }

  /** Shipping 买运单（FBM 推单用） */
  @Post(':shopId/shipping/label')
  async shippingLabel(@Param('shopId') shopId: string, @TenantId() tenantId: string, @Body() body: ShippingLabelBody) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(
      await adapter.purchaseShippingLabel({
        amazonOrderId: body.amazonOrderId,
        items: body.items,
        shipFromAddress: body.shipFromAddress,
      }),
    )
  }

  /** Reports 请求报表 */
  @Post(':shopId/reports')
  async requestReport(@Param('shopId') shopId: string, @TenantId() tenantId: string, @Body() body: ReportBody) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(
      await adapter.requestReport(body.reportType, body.dataStartTime, body.dataEndTime),
    )
  }

  /** Reports 报表状态查询 */
  @Get(':shopId/reports/:reportId')
  async getReport(@Param('shopId') shopId: string, @Param('reportId') reportId: string, @TenantId() tenantId: string) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(await adapter.getReport(reportId))
  }

  /** Reports 结算汇总（下载并解析指定结算文档） */
  @Get(':shopId/reports/settlement/:documentId')
  async settlement(
    @Param('shopId') shopId: string,
    @Param('documentId') documentId: string,
    @TenantId() tenantId: string,
  ) {
    if (!tenantId) throw new BusinessException('TENANT_REQUIRED', '缺少租户上下文', HttpStatus.BAD_REQUEST)
    const adapter = await this.resolveAdapter(shopId, tenantId)
    return ok(await adapter.getSettlementSummary(documentId))
  }
}
