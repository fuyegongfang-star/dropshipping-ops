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

  /** 采购单列表（租户隔离），支持按 status / shopId 过滤。 */
  list(tenantId: string, filters: { status?: string; shopId?: string } = {}) {
    const where: Prisma.PurchaseOrderWhereInput = { tenantId }
    if (filters.status) where.status = filters.status
    if (filters.shopId) where.shopId = filters.shopId
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

  /** 新增采购单（含行项），tenantId 来自租户上下文（§0/§17）。 */
  async create(tenantId: string, dto: CreatePurchaseOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BusinessException('PO_ITEM_REQUIRED', '采购单至少需要 1 个行项', HttpStatus.BAD_REQUEST)
    }
    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        shopId: dto.shopId ?? null,
        orderId: dto.orderId ?? null,
        trackingNo: dto.trackingNo,
        carrier: dto.carrier,
        platformOrderNo: dto.platformOrderNo ?? null,
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
}
