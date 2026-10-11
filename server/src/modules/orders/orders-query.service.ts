/**
 * 订单查询服务（演示可视化只读接口，配套前端「订单中心」）。
 * 所有查询按 tenantId 过滤，配合租户中间件注入的上下文实现行级隔离（§0/§17）。
 *
 * 负责人：人工补开发（可视化闭环）｜ 创建：2026-10-11
 */

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

/** 列表项（附带店铺简况，避免前端再查一次） */
export interface OrderListItem {
  id: string
  tenantId: string
  shopId: string
  platformOrderNo: string
  status: string
  subStatus: string | null
  totalAmount: unknown
  currency: string | null
  createdAt: Date
  shop: { id: string; name: string; platform: string } | null
}

/** 详情（明细含内部 SKU 映射 + 事件审计 + 逆向单） */
export interface OrderDetail extends OrderListItem {
  recipient: unknown
  raw: unknown
  items: Array<{
    id: string
    skuId: string | null
    quantity: number
    price: unknown
    sku: { code: string; platformSku: string | null; supplierSku: string | null } | null
  }>
  events: Array<{
    id: string
    type: string
    from: string | null
    to: string | null
    operator: string | null
    createdAt: Date
  }>
  reverseOrders: Array<{ id: string; type: string; status: string; cause: string | null }>
}

@Injectable()
export class OrdersQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 订单列表（可按状态过滤），附带店铺简况 */
  async list(tenantId: string, status?: string): Promise<OrderListItem[]> {
    const orders = await this.prisma.order.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    const shopIds = Array.from(
      new Set(orders.map((o) => o.shopId).filter(Boolean)),
    ) as string[]
    const shops = shopIds.length
      ? await this.prisma.shop.findMany({
          where: { id: { in: shopIds } },
          select: { id: true, name: true, platform: true },
        })
      : []
    const shopMap = new Map(shops.map((s) => [s.id, s]))
    return orders.map((o) => ({
      ...o,
      shop: o.shopId ? (shopMap.get(o.shopId) ?? null) : null,
    }))
  }

  /** 订单详情：明细（含内部 SKU 映射）+ 事件审计 + 逆向单 */
  async detail(tenantId: string, id: string): Promise<OrderDetail | null> {
    const order = await this.prisma.order.findFirst({ where: { id, tenantId } })
    if (!order) return null

    const shop = order.shopId
      ? await this.prisma.shop.findUnique({
          where: { id: order.shopId },
          select: { id: true, name: true, platform: true },
        })
      : null

    const items = await this.prisma.orderItem.findMany({ where: { orderId: id } })
    const itemsWithSku = await Promise.all(
      items.map(async (it) => ({
        ...it,
        sku: it.skuId
          ? await this.prisma.sku.findUnique({
              where: { id: it.skuId },
              select: { code: true, platformSku: true, supplierSku: true },
            })
          : null,
      })),
    )

    const events = await this.prisma.orderEvent.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
    })
    const reverseOrders = await this.prisma.reverseOrder.findMany({ where: { orderId: id } })

    return { ...order, shop, items: itemsWithSku, events, reverseOrders }
  }
}
