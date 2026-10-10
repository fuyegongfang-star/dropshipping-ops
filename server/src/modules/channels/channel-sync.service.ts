/**
 * 渠道同步服务（任务 1.1 拉单落库实现，方案 §3 拉单 / §13.1 初始态）。
 * 编排：解析店铺 → 取适配器 → 拉单 → 归一化订单 upsert 落库（初始态 pending_review）
 *       → 回写平台确认。单条失败不中断整体（看门狗：单点失败跳过，§0/§31）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import { ChannelRegistryService } from './channel-registry.service'
import { ChannelPlatform, ChannelPullOptions, ChannelPullSummary } from './channel.constants'
import { PulledChannelOrderResult, ChannelOrderItemDto } from './dto/pulled-order.dto'
import { CatalogService } from '../catalog/catalog.service'

@Injectable()
export class ChannelSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly registry: ChannelRegistryService,
    private readonly logger: AppLogger,
    private readonly catalog?: CatalogService,
  ) {}

  /**
   * 拉单并落库（§3 拉单）。
   * 落库策略：以 (tenantId, platformOrderNo) 唯一键 upsert；新订单建 Order+OrderItem，
   * 状态置 `pending_review`（状态机初始态，§13.1）；已存在仅刷新 raw/recipient 快照。
   */
  async pullAndStore(shopId: string, options: ChannelPullOptions = {}): Promise<ChannelPullSummary> {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, tenantId: true, platform: true, name: true },
    })
    if (!shop) {
      throw new BusinessException('SHOP_NOT_FOUND', '店铺不存在', HttpStatus.NOT_FOUND)
    }

    const adapter = this.registry.resolveForShop(shop)
    const pulled = await adapter.pullOrders(options)

    const summary: ChannelPullSummary = {
      shopId: shop.id,
      platform: adapter.getPlatform(),
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }

    // 逐单落库：单条失败计入 failed，不中断整体（看门狗，§0/§31）
    for (const result of pulled) {
      try {
        await this.upsertOrder(shop.tenantId, shop.id, result)
        summary.created += 1
      } catch (err) {
        summary.failed += 1
        summary.errors.push(`${result.order.platformOrderNo}: ${(err as Error).message}`)
        this.logger.error(
          `拉单落库失败 shop=${shop.id} order=${result.order.platformOrderNo}`,
          (err as Error).stack,
          'ChannelSync',
        )
      }
    }

    // 拉单确认：通知平台已接收，防重复拉取（幂等，§9.4）
    await this.acknowledgeSafe(adapter, pulled)

    return summary
  }

  /** 单条订单 upsert：新建 Order+OrderItem 或刷新快照 */
  private async upsertOrder(
    tenantId: string,
    shopId: string,
    result: PulledChannelOrderResult,
  ): Promise<void> {
    const { order, raw } = result
    const existing = await this.prisma.order.findUnique({
      where: {
        tenantId_platformOrderNo: { tenantId, platformOrderNo: order.platformOrderNo },
      },
      select: { id: true },
    })

    if (!existing) {
      // 新建：Order + 嵌套 OrderItem（按标量外键逐一创建，见 schema 关联关系约定）
      const created = await this.prisma.order.create({
        data: {
          tenantId,
          shopId,
          platformOrderNo: order.platformOrderNo,
          status: 'pending_review', // 状态机初始态（§13.1），审单引擎后续处理（§1.4）
          raw: raw as unknown as Prisma.InputJsonValue,
          recipient: order.recipient as unknown as Prisma.InputJsonValue,
          totalAmount:
            order.totalAmount != null ? new Prisma.Decimal(order.totalAmount) : null,
          currency: order.currency ?? null,
        },
        select: { id: true },
      })
      // 平台 SKU→内部 SKU 映射回填（§1.7）：命中映射则关联内部 skuId，否则留空
      const items = await Promise.all(
        order.items.map(async (it) => ({
          tenantId,
          orderId: created.id,
          skuId: await this.resolveItemSkuId(tenantId, it),
          quantity: it.quantity,
          price: it.price != null ? new Prisma.Decimal(it.price) : null,
        })),
      )
      await this.prisma.orderItem.createMany({ data: items })
    } else {
      // 已存在：仅刷新原始快照与收件人，不重复建明细（避免重复，审单引擎后续处理）
      await this.prisma.order.update({
        where: { id: existing.id },
        data: {
          raw: raw as unknown as Prisma.InputJsonValue,
          recipient: order.recipient as unknown as Prisma.InputJsonValue,
        },
      })
    }
  }

  /**
   * 解析订单项的内部 SKU（§1.7 平台↔内部映射回填）。
   * 取平台 SKU（缺省回退内部 skuCode）查内部 SKU；未注入映射服务或查不到时返回 null（不阻断落库）。
   */
  private async resolveItemSkuId(
    tenantId: string,
    item: ChannelOrderItemDto,
  ): Promise<string | null> {
    if (!this.catalog) return null
    const key = item.platformSku ?? item.skuCode
    if (!key) return null
    const sku = await this.catalog.resolveByPlatformSku(tenantId, key)
    return sku ? sku.id : null
  }

  /** 拉单确认（失败不影响主流程，仅记录日志） */
  private async acknowledgeSafe(
    adapter: { getPlatform(): ChannelPlatform; acknowledgeOrders(nos: string[]): Promise<void> },
    pulled: PulledChannelOrderResult[],
  ): Promise<void> {
    if (pulled.length === 0) return
    const nos = pulled.map((p) => p.order.platformOrderNo)
    try {
      await adapter.acknowledgeOrders(nos)
    } catch (err) {
      this.logger.warn(`拉单确认失败 platform=${adapter.getPlatform()}`, 'ChannelSync')
      this.logger.debug((err as Error).message, 'ChannelSync')
    }
  }
}
