/**
 * 中转仓看板服务（任务 6.5 中转仓模型 + 看板，方案阶段6 详细设计）。
 *
 * 货代侧作业视角：把「已到仓 / 已匹配 / 已打包 但 未出库」的采购单汇聚成待作业队列，
 * 并附带其关联店铺订单概览，供中转仓操作员扫码、打包、出单、出库逐环节推进（6.6–6.9）。
 *
 * 租户隔离：仓库与采购单均按 tenantId 过滤；关联订单同样限定本租户（§17 防越权）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-25
 */

import { Injectable } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AppLogger } from '../../common/logger/app.logger'

// 待作业采购单状态：已到仓 → 已匹配 → 已打包，尚未出库（outbound 即离开中转仓）。
const PENDING_PO_STATUSES = ['arrived', 'matched', 'packed']

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  /** 获取中转仓看板：中转仓列表 + 待作业采购单（含关联订单概览） */
  async getBoard(tenantId: string): Promise<{
    warehouses: { id: string; tenantId: string; name: string; type: 'transfer'; region: string | null; createdAt: string }[]
    purchaseOrders: {
      id: string
      tenantId: string
      shopId: string | null
      orderId: string | null
      trackingNo: string
      carrier: string
      platformOrderNo: string | null
      recipientName: string | null
      status: string
      items: { id: string; productName: string; quantity: number; skuId: string | null }[]
      order: { id: string; platformOrderNo: string | null; status: string; recipientName: string | null } | null
    }[]
    stats: { transferWarehouseCount: number; pendingPoCount: number; byStatus: Record<string, number> }
  }> {
    // 1) 本租户中转仓
    const warehouses = await this.prisma.warehouse.findMany({
      where: { tenantId, type: 'transfer' },
      orderBy: { createdAt: 'desc' },
    })

    // 2) 待作业采购单（已到仓/已匹配/已打包，未出库）
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, status: { in: PENDING_PO_STATUSES } },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    })

    // 3) 批量拉取关联店铺订单概览（同租户，防越权）
    const orderIds = Array.from(new Set(pos.map((p) => p.orderId).filter(Boolean) as string[]))
    const orders = orderIds.length
      ? await this.prisma.order.findMany({
          where: { tenantId, id: { in: orderIds } },
          select: { id: true, platformOrderNo: true, status: true, recipient: true },
        })
      : []
    const orderMap = new Map(orders.map((o) => [o.id, o]))

    const purchaseOrders = pos.map((po) => {
      const linked = po.orderId ? orderMap.get(po.orderId) : undefined
      return {
        id: po.id,
        tenantId: po.tenantId,
        shopId: po.shopId,
        orderId: po.orderId,
        trackingNo: po.trackingNo,
        carrier: po.carrier,
        platformOrderNo: po.platformOrderNo,
        recipientName: po.recipientName,
        status: po.status,
        items: po.items.map((it) => ({
          id: it.id,
          productName: it.productName,
          quantity: it.quantity,
          skuId: it.skuId,
        })),
        order: linked
          ? {
              id: linked.id,
              platformOrderNo: linked.platformOrderNo,
              status: linked.status,
              recipientName: (linked.recipient as { name?: string } | null)?.name ?? null,
            }
          : null,
      }
    })

    const byStatus: Record<string, number> = {}
    for (const po of purchaseOrders) byStatus[po.status] = (byStatus[po.status] ?? 0) + 1

    this.logger.log(
      `[TRANSFER] 看板 tenant=${tenantId} 中转仓=${warehouses.length} 待作业采购单=${purchaseOrders.length}`,
      'Transfer',
    )

    return {
      warehouses: warehouses.map((w) => ({
        id: w.id,
        tenantId: w.tenantId,
        name: w.name,
        type: 'transfer',
        region: w.region,
        createdAt: w.createdAt.toISOString(),
      })),
      purchaseOrders,
      stats: {
        transferWarehouseCount: warehouses.length,
        pendingPoCount: purchaseOrders.length,
        byStatus,
      },
    }
  }
}
