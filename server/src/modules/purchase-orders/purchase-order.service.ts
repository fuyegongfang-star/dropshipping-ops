/**
 * 采购单服务（任务 6.2，方案 §21 衍生 / 阶段6 中转仓作业流）。
 * 提供：采购单列表（租户隔离 + status/shop 过滤）、新增、状态推进、详情；全链路租户行级隔离（§0/§17）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-24
 */

import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/response/business.exception'
import { HttpStatus } from '@nestjs/common'
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
  type CreatePurchaseOrderDto,
  type UpdatePurchaseOrderStatusDto,
} from './dto/purchase-order.dto'

// 采购单状态机（§6 阶段6）：当前态 → 允许推进的目标态集合（防非法跳变）。
const STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  pending: ['arrived'], // 6.6 扫码到货
  arrived: ['matched'], // 6.4/6.6 匹配店铺订单
  matched: ['packed'], // 6.7 打包
  packed: ['outbound'], // 6.9 出库
  outbound: [], // 终态
}

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /** 采购单列表（租户隔离），支持按 status / shopId / orderId 过滤。 */
  list(tenantId: string, filters: { status?: string; shopId?: string; orderId?: string } = {}) {
    const where: Prisma.PurchaseOrderWhereInput = { tenantId }
    if (filters.status) where.status = filters.status
    if (filters.shopId) where.shopId = filters.shopId
    if (filters.orderId) where.orderId = filters.orderId
    return this.prisma.purchaseOrder.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** 采购单详情（租户隔离，跨租户/不存在抛错，防 IDOR）。 */
  async getById(tenantId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: true },
    })
    if (!po) {
      throw new BusinessException('PURCHASE_ORDER_NOT_FOUND', '采购单不存在', HttpStatus.NOT_FOUND)
    }
    return po
  }

  /**
   * 新增采购单（含行项），tenantId 来自租户上下文（§0/§17）。
   * 任务 6.10：支持录入时直接带 orderId 建立关联——校验订单归属本租户（防 IDOR），
   * 并自动回填 shopId / platformOrderNo / recipientName，避免二次手动匹配出错。
   */
  /**
   * 生成业务采购单号：CG + 年月日 + 当日 4 位流水（如 CG20261028-0001）。
   * 与内部 id(cuid) 区分：cuid 无法印成条码，现场只能扫业务单号（6.12 扫码维度）。
   */
  private async nextPurchaseNo(tenantId: string): Promise<string> {
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const prefix = `CG${ymd}-`
    const used = await this.prisma.purchaseOrder.count({
      where: { tenantId, purchaseNo: { startsWith: prefix } },
    })
    return `${prefix}${String(used + 1).padStart(4, '0')}`
  }

  async create(tenantId: string, dto: CreatePurchaseOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BusinessException('PO_ITEM_REQUIRED', '采购单至少需要 1 个行项', HttpStatus.BAD_REQUEST)
    }
    let shopId = dto.shopId ?? null
    let platformOrderNo = dto.platformOrderNo ?? null
    let recipientName = dto.recipientName ?? null
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: dto.orderId, tenantId },
        select: { id: true, shopId: true, platformOrderNo: true, recipient: true },
      })
      if (!order) {
        throw new BusinessException('ORDER_NOT_FOUND', '关联的店铺订单不存在或无权限', HttpStatus.NOT_FOUND)
      }
      shopId = shopId ?? order.shopId ?? null
      platformOrderNo = platformOrderNo ?? order.platformOrderNo ?? null
      recipientName =
        recipientName ?? ((order.recipient as { name?: string } | null)?.name ?? null)
    }
    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        shopId,
        orderId: dto.orderId ?? null,
        trackingNo: dto.trackingNo,
        // 6.12：业务采购单号（可印成条码供扫码枪识别），不传则按当日流水自动生成
        purchaseNo: dto.purchaseNo ?? (await this.nextPurchaseNo(tenantId)),
        carrier: dto.carrier,
        platformOrderNo,
        recipientName,
        purchaseUrl: dto.purchaseUrl ?? null,
        productImages: (dto.productImages ?? []) as unknown as Prisma.InputJsonValue,
        remark: dto.remark ?? null,
        status: 'pending',
        items: {
          create: dto.items.map((it) => ({
            skuId: it.skuId ?? null,
            productName: it.productName,
            quantity: it.quantity,
            imageUrl: it.imageUrl ?? null,
            unitPrice: it.unitPrice ?? null,
          })),
        },
      },
      include: { items: true },
    })
  }

  /** 推进采购单状态：校验状态机合法转移（§6），非法转移抛错。 */
  async updateStatus(tenantId: string, id: string, dto: UpdatePurchaseOrderStatusDto) {
    const po = await this.getById(tenantId, id)
    const current = po.status as PurchaseOrderStatus
    const target = dto.status as PurchaseOrderStatus
    if (!PURCHASE_ORDER_STATUS.includes(target)) {
      throw new BusinessException('PO_STATUS_INVALID', `非法状态：${target}`, HttpStatus.BAD_REQUEST)
    }
    const allowed = STATUS_TRANSITIONS[current] ?? []
    if (!allowed.includes(target)) {
      throw new BusinessException(
        'PO_STATUS_TRANSITION',
        `状态不可从 ${current} 直接转为 ${target}`,
        HttpStatus.BAD_REQUEST,
      )
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: target },
      include: { items: true },
    })
  }

  // ===== 6.4 采购单↔店铺订单 匹配 / 关联 =====
  // 关联（orderId）与状态机解耦：关联只是建立归属，物理进度（arrived→matched→...）仍由 updateStatus 推进。

  /** 按 orderId 拉取已关联该店铺订单的采购单（订单详情展示用）。 */
  listByOrder(tenantId: string, orderId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId, orderId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** 候选店铺订单 + 命中理由（平台订单号 / 收件人 / SKU 重叠），按匹配强度降序。 */
  async findCandidates(tenantId: string, poId: string) {
    const po = await this.getById(tenantId, poId)
    const poSkuIds = po.items.map((i) => i.skuId).filter(Boolean) as string[]

    // Order 与 OrderItem 在 schema 中无显式 relation（订单模块按 orderId 直接查），分批取行项。
    const orders = await this.prisma.order.findMany({ where: { tenantId } })
    const orderIds = orders.map((o) => o.id)
    const allItems = orderIds.length
      ? await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } } })
      : []
    const itemsByOrder = new Map<string, { skuId: string | null }[]>()
    for (const it of allItems) {
      if (!itemsByOrder.has(it.orderId)) itemsByOrder.set(it.orderId, [])
      itemsByOrder.get(it.orderId)!.push(it)
    }

    const weight = (reasons: string[]): number =>
      (reasons.includes('平台订单号一致') ? 100 : 0) +
      (reasons.includes('收件人一致') ? 50 : 0) +
      reasons.filter((r) => r.startsWith('SKU')).length

    const candidates = orders
      .map((order) => {
        const reasons: string[] = []
        if (po.platformOrderNo && order.platformOrderNo === po.platformOrderNo) {
          reasons.push('平台订单号一致')
        }
        const recvName = (order.recipient as { name?: string } | null)?.name
        if (po.recipientName && recvName && recvName === po.recipientName) {
          reasons.push('收件人一致')
        }
        const orderSkuIds = (itemsByOrder.get(order.id) ?? [])
          .map((i) => i.skuId)
          .filter(Boolean) as string[]
        const shared = poSkuIds.filter((s) => orderSkuIds.includes(s))
        if (shared.length) reasons.push(`SKU 重叠 ${shared.length} 个`)
        return {
          orderId: order.id,
          platformOrderNo: order.platformOrderNo,
          status: order.status,
          reasons,
        }
      })
      .filter((c) => c.reasons.length > 0)
      .sort((a, b) => weight(b.reasons) - weight(a.reasons))
      .slice(0, 10)

    return candidates
  }

  /** 自动匹配：在同租户候选订单中取最强命中并关联；已关联则幂等返回。 */
  async autoMatch(tenantId: string, poId: string) {
    const po = await this.getById(tenantId, poId)
    if (po.orderId) {
      return { linked: true, orderId: po.orderId, reasons: [] as string[], message: '采购单已关联店铺订单' }
    }
    const candidates = await this.findCandidates(tenantId, poId)
    if (!candidates.length) {
      return { linked: false, orderId: null, reasons: [] as string[], message: '未找到可匹配的店铺订单（平台单号/收件人/SKU 均不匹配）' }
    }
    const best = candidates[0]
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { orderId: best.orderId },
      include: { items: true },
    })
    return {
      linked: true,
      orderId: best.orderId,
      reasons: best.reasons,
      message: `已自动关联店铺订单 ${best.platformOrderNo}`,
      purchaseOrder: updated,
    }
  }

  /** 手动关联：校验目标订单存在且同租户（防 IDOR），关联后返回。 */
  async link(tenantId: string, poId: string, orderId: string) {
    await this.getById(tenantId, poId) // 租户隔离校验（跨租户/缺失抛 404）
    const order = await this.prisma.order.findFirst({ where: { id: orderId, tenantId } })
    if (!order) {
      throw new BusinessException('ORDER_NOT_FOUND', '目标店铺订单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { orderId },
      include: { items: true },
    })
  }

  /** 解除关联（清空 orderId）。 */
  async unlink(tenantId: string, poId: string) {
    const po = await this.getById(tenantId, poId)
    if (!po.orderId) return po
    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { orderId: null },
      include: { items: true },
    })
  }

  // ===== 7.2 收货标签打印 =====

  /**
   * 收货标签数据：供应商贴箱 → 中转仓扫码到货（6.6）所需全部信息。
   * - 行项 skuCode 优先取内部 SKU 编码（Sku.code），缺 skuId 时回退内部 id，再回退 '-'；
   * - supplier 取采购链接（purchaseUrl）作为溯源信息，可能为空；
   * - printedAt 为服务端当前时间（ISO），供前端打印时间展示。
   */
  async getLabelData(tenantId: string, id: string) {
    const po = await this.getById(tenantId, id)
    const skuIds = po.items.map((i) => i.skuId).filter(Boolean) as string[]
    const skuMap = skuIds.length
      ? new Map(
          (await this.prisma.sku.findMany({ where: { id: { in: skuIds } } })).map((s) => [s.id, s.code]),
        )
      : new Map<string, string>()
    const items = po.items.map((it) => ({
      skuCode: (it.skuId && skuMap.get(it.skuId)) || it.skuId || '-',
      productName: it.productName,
      quantity: it.quantity,
    }))
    return {
      purchaseNo: po.purchaseNo ?? '',
      carrier: po.carrier,
      trackingNo: po.trackingNo,
      supplier: po.purchaseUrl ?? null,
      items,
      remark: po.remark ?? null,
      boxCount: po.boxCount,
      printedAt: new Date().toISOString(),
    }
  }

  /** 更新收货标签箱数（仅此字段，租户隔离校验后落库）。 */
  async updateBoxCount(tenantId: string, id: string, boxCount: number) {
    await this.getById(tenantId, id) // 租户隔离校验（跨租户/缺失抛 404）
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { boxCount },
      include: { items: true },
    })
  }
}
