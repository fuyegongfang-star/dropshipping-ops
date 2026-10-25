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
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { AppLogger } from '../../common/logger/app.logger'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'
import { PurchaseOrderService } from '../purchase-orders/purchase-order.service'
import { ScanTransferDto } from './transfer.dto'

// 待作业采购单状态：已到仓 → 已匹配 → 已打包，尚未出库（outbound 即离开中转仓）。
const PENDING_PO_STATUSES = ['arrived', 'matched', 'packed']

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly poService: PurchaseOrderService,
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

  /**
   * 扫码到货入库（任务 6.6）。
   *
   * 流程：校验中转仓归属 → 按扫码类型解析采购单（快递单号 / SKU 条码 / 采购单号）
   * → 生成收货单 ASN（received + 行项快照）→ 推进采购单 pending→arrived（状态机首跳 §6）
   * → 复用 6.4 自动匹配关联店铺订单（便于后续打包出单）→ 返回登记结果。
   *
   * 租户隔离：中转仓、采购单、关联订单均限定当前租户（§17 防越权）。
   */
  async scan(
    tenantId: string,
    dto: ScanTransferDto,
  ): Promise<{
    asn: {
      id: string
      warehouseId: string
      purchaseOrderId: string | null
      scanSource: string
      status: string
      receivedItemCount: number
      createdAt: string
    }
    purchaseOrder: { id: string; trackingNo: string; carrier: string; status: string; orderId: string | null }
    matched: boolean
    advanced: boolean
    message: string
  }> {
    // 1) 校验中转仓归属（租户隔离，防越权）
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId },
    })
    if (!warehouse) {
      throw new BusinessException('WAREHOUSE_NOT_FOUND', '中转仓不存在或无权限', HttpStatus.NOT_FOUND)
    }

    // 2) 按扫码类型解析采购单
    const po = await this.resolvePurchaseOrder(tenantId, dto)
    if (!po) {
      throw new BusinessException(
        'SCAN_NO_PURCHASE_ORDER',
        '未找到匹配的采购单，请核对快递单号 / 条码 / 采购单号',
        HttpStatus.NOT_FOUND,
      )
    }

    // 3) 到货登记：生成收货单 ASN（received）+ 行项快照
    const receivedItems = po.items.map((it) => ({
      id: it.id,
      productName: it.productName,
      quantity: it.quantity,
      skuId: it.skuId,
      imageUrl: it.imageUrl,
    }))
    const asn = await this.prisma.asn.create({
      data: {
        tenantId,
        warehouseId: warehouse.id,
        status: 'received',
        purchaseOrderId: po.id,
        scanSource: dto.scanType,
        receivedItems: receivedItems as unknown as Prisma.InputJsonValue,
      },
    })

    // 4) 推进采购单状态：pending → arrived（状态机首跳，§6）
    let advanced = false
    let latestPo = po
    if (po.status === 'pending') {
      latestPo = await this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'arrived' },
        include: { items: true },
      })
      advanced = true
    }

    // 5) 匹配订单（复用 6.4 自动匹配，关联店铺订单便于后续出单）
    let matched = false
    if (!latestPo.orderId) {
      const m = await this.poService.autoMatch(tenantId, po.id)
      matched = m.linked
      if (matched) {
        const refreshed = await this.prisma.purchaseOrder.findFirst({
          where: { id: po.id, tenantId },
          include: { items: true },
        })
        if (refreshed) latestPo = refreshed
      }
    } else {
      matched = true
    }

    this.logger.log(
      `[TRANSFER] 到货入库 tenant=${tenantId} asn=${asn.id} po=${po.id} warehouse=${warehouse.id} advanced=${advanced} matched=${matched}`,
      'Transfer',
    )

    return {
      asn: {
        id: asn.id,
        warehouseId: asn.warehouseId,
        purchaseOrderId: asn.purchaseOrderId,
        scanSource: asn.scanSource ?? dto.scanType,
        status: asn.status,
        receivedItemCount: receivedItems.length,
        createdAt: asn.createdAt.toISOString(),
      },
      purchaseOrder: {
        id: latestPo.id,
        trackingNo: latestPo.trackingNo,
        carrier: latestPo.carrier,
        status: latestPo.status,
        orderId: latestPo.orderId,
      },
      matched,
      advanced,
      message: advanced
        ? `到货登记成功，采购单 ${po.trackingNo} 已转为 arrived`
        : `到货登记成功（采购单当前状态 ${latestPo.status}）`,
    }
  }

  /** 按扫码类型解析采购单（快递单号 / SKU 条码 / 采购单号），均限定租户。 */
  private async resolvePurchaseOrder(tenantId: string, dto: ScanTransferDto) {
    switch (dto.scanType) {
      case 'trackingNo':
        return this.prisma.purchaseOrder.findFirst({
          where: { tenantId, trackingNo: dto.scanValue },
          include: { items: true },
        })
      case 'purchaseNo':
        return this.prisma.purchaseOrder.findFirst({
          where: { tenantId, id: dto.scanValue },
          include: { items: true },
        })
      case 'barcode': {
        // SKU 条码：经采购单明细反查父采购单（同租户）
        const item = await this.prisma.purchaseOrderItem.findFirst({
          where: { skuId: dto.scanValue },
          include: { purchaseOrder: true },
        })
        if (item?.purchaseOrder && item.purchaseOrder.tenantId === tenantId) {
          return this.prisma.purchaseOrder.findFirst({
            where: { id: item.purchaseOrder.id, tenantId },
            include: { items: true },
          })
        }
        return null
      }
      default:
        return null
    }
  }
}
