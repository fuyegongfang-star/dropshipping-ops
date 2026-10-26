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
import type {
  PackQueueItem,
  PackTaskDto,
  PackCheckRow,
  PackTaskCheck,
} from './transfer.types'

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

  // ===== 6.7 中转仓作业：打包任务 + 核对 =====
  // 业务闭环：已到仓采购单经 6.4/6.6 自动匹配店铺订单 → 进入「已匹配 matched」
  // → 按关联订单聚合生成打包任务 → 核对采购行项 vs 订单行项（差异高亮）→ 标记打包
  // →（6.8 出跨境面单 / 6.9 出库）。全部租户隔离（§17 防越权）。

  /**
   * 待打包队列（6.7）：把本租户「已匹配且已关联店铺订单」的采购单按订单聚合，
   * 预计算采购行项 vs 订单行项的核对差异，并标注是否已生成打包任务。
   */
  async getPackQueue(tenantId: string): Promise<{
    items: PackQueueItem[]
    stats: { matchedPoCount: number; taskCount: number; pendingTaskCount: number; packedTaskCount: number }
  }> {
    // 1) 已匹配且已关联订单的采购单
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, status: 'matched', orderId: { not: null } },
      include: { items: true },
      orderBy: { updatedAt: 'desc' },
    })

    // 2) 按关联订单聚合
    const groups = new Map<string, typeof pos>()
    for (const p of pos) {
      const oid = p.orderId as string
      if (!groups.has(oid)) groups.set(oid, [])
      groups.get(oid)!.push(p)
    }
    const orderIds = Array.from(groups.keys())

    // 3) 批量拉取关联订单与订单行项（避免 N+1）
    const orders = orderIds.length
      ? await this.prisma.order.findMany({
          where: { tenantId, id: { in: orderIds } },
          select: { id: true, platformOrderNo: true, status: true, recipient: true },
        })
      : []
    const orderMap = new Map(orders.map((o) => [o.id, o]))
    const allOrderItems = orderIds.length
      ? await this.prisma.orderItem.findMany({ where: { tenantId, orderId: { in: orderIds } } })
      : []
    const oiByOrder = new Map<string, { skuId: string | null; quantity: number }[]>()
    for (const oi of allOrderItems) {
      if (!oiByOrder.has(oi.orderId)) oiByOrder.set(oi.orderId, [])
      oiByOrder.get(oi.orderId)!.push({ skuId: oi.skuId, quantity: oi.quantity })
    }

    // 4) 已生成的打包任务（按订单）
    const tasks = orderIds.length
      ? await this.prisma.packTask.findMany({ where: { tenantId, orderId: { in: orderIds } } })
      : []
    const taskByOrder = new Map(tasks.map((t) => [t.orderId, t]))

    const items: PackQueueItem[] = []
    for (const [oid, groupPos] of groups) {
      const order = orderMap.get(oid)
      const orderItems = oiByOrder.get(oid) ?? []
      const poItems = groupPos.flatMap((p) =>
        p.items.map((it) => ({ skuId: it.skuId, productName: it.productName, quantity: it.quantity })),
      )
      const { diffs, summary } = this.computeCheck(poItems, orderItems)
      const t = taskByOrder.get(oid)
      items.push({
        orderId: oid,
        order: order
          ? {
              id: order.id,
              platformOrderNo: order.platformOrderNo,
              status: order.status,
              recipientName: (order.recipient as { name?: string } | null)?.name ?? null,
            }
          : null,
        purchaseOrders: groupPos.map((p) => ({
          id: p.id,
          trackingNo: p.trackingNo,
          carrier: p.carrier,
          status: p.status,
        })),
        purchaseOrderIds: groupPos.map((p) => p.id),
        task: t ? { id: t.id, status: t.status } : null,
        diffs,
        summary,
      })
    }

    const taskCount = tasks.length
    this.logger.log(
      `[TRANSFER] 待打包队列 tenant=${tenantId} 匹配采购单=${pos.length} 聚合订单=${items.length} 已建任务=${taskCount}`,
      'Transfer',
    )
    return {
      items,
      stats: {
        matchedPoCount: pos.length,
        taskCount,
        pendingTaskCount: tasks.filter((t) => t.status === 'pending').length,
        packedTaskCount: tasks.filter((t) => t.status === 'packed').length,
      },
    }
  }

  /**
   * 生成打包任务（6.7）：对每一个「已匹配且已关联订单」的采购单聚合组，创建一个打包任务（幂等，
   * 已存在则跳过）。打包任务后续在 6.8 出单 / 6.9 出库时回填 channelCode/labelId/shipmentId。
   */
  async generatePackTasks(
    tenantId: string,
  ): Promise<{ created: number; tasks: PackTaskDto[] }> {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, status: 'matched', orderId: { not: null } },
      select: { id: true, orderId: true },
    })
    const groups = new Map<string, string[]>()
    for (const p of pos) {
      const oid = p.orderId as string
      if (!groups.has(oid)) groups.set(oid, [])
      groups.get(oid)!.push(p.id)
    }
    if (!groups.size) {
      return { created: 0, tasks: await this.listPackTasks(tenantId) }
    }

    // 默认出单仓：本租户首个中转仓（6.8 出单时若需换仓可再改）
    const wh = await this.prisma.warehouse.findFirst({
      where: { tenantId, type: 'transfer' },
      orderBy: { createdAt: 'asc' },
    })

    // 已存在的任务（按订单去重，幂等）
    const existing = await this.prisma.packTask.findMany({
      where: { tenantId, orderId: { in: Array.from(groups.keys()) } },
      select: { orderId: true },
    })
    const existingOrders = new Set(existing.map((t) => t.orderId))

    let created = 0
    for (const [oid, poIds] of groups) {
      if (existingOrders.has(oid)) continue
      await this.prisma.packTask.create({
        data: {
          tenantId,
          warehouseId: wh?.id ?? null,
          orderId: oid,
          purchaseOrderIds: poIds as unknown as Prisma.InputJsonValue,
          status: 'pending',
        },
      })
      created++
    }
    this.logger.log(`[TRANSFER] 生成打包任务 tenant=${tenantId} 新建=${created}`, 'Transfer')
    return { created, tasks: await this.listPackTasks(tenantId) }
  }

  /** 打包任务列表（6.7，按租户，含关联订单与采购单摘要）。 */
  async listPackTasks(tenantId: string): Promise<PackTaskDto[]> {
    const tasks = await this.prisma.packTask.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    const orderIds = tasks.map((t) => t.orderId).filter(Boolean) as string[]
    const orders = orderIds.length
      ? await this.prisma.order.findMany({
          where: { tenantId, id: { in: orderIds } },
          select: { id: true, platformOrderNo: true, status: true, recipient: true },
        })
      : []
    const orderMap = new Map(orders.map((o) => [o.id, o]))
    const poIds = tasks.flatMap((t) => (t.purchaseOrderIds as unknown as string[]) ?? [])
    const pos = poIds.length
      ? await this.prisma.purchaseOrder.findMany({ where: { tenantId, id: { in: poIds } } })
      : []
    const poMap = new Map(pos.map((p) => [p.id, p]))
    return tasks.map((t) => this.toPackTaskDto(t, orderMap.get(t.orderId as string), poMap))
  }

  /**
   * 打包任务核对（6.7）：聚合采购行项与店铺订单行项对比，输出逐行差异（差异高亮，§1/§21）。
   * 核对维度：skuId（优先）→ 产品名；产出 matched / qty_mismatch / missing_in_po / extra_in_po / unverified。
   */
  async getPackCheck(
    tenantId: string,
    packTaskId: string,
  ): Promise<import('./transfer.types').PackTaskCheck> {
    const task = await this.prisma.packTask.findFirst({ where: { id: packTaskId, tenantId } })
    if (!task) {
      throw new BusinessException('PACK_TASK_NOT_FOUND', '打包任务不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const poIds = (task.purchaseOrderIds as unknown as string[]) ?? []
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { id: { in: poIds }, tenantId },
      include: { items: true },
    })
    const order = task.orderId
      ? await this.prisma.order.findFirst({
          where: { id: task.orderId, tenantId },
          select: { id: true, platformOrderNo: true, status: true, recipient: true },
        })
      : null
    const orderItems = task.orderId
      ? await this.prisma.orderItem.findMany({ where: { orderId: task.orderId, tenantId } })
      : []
    const poItems = pos.flatMap((p) =>
      p.items.map((it) => ({ skuId: it.skuId, productName: it.productName, quantity: it.quantity })),
    )
    const { diffs, summary } = this.computeCheck(
      poItems,
      orderItems.map((oi) => ({ skuId: oi.skuId, quantity: oi.quantity })),
    )
    return {
      packTaskId: task.id,
      order: order
        ? {
            id: order.id,
            platformOrderNo: order.platformOrderNo,
            status: order.status,
            recipientName: (order.recipient as { name?: string } | null)?.name ?? null,
          }
        : null,
      purchaseOrders: pos.map((p) => ({
        id: p.id,
        trackingNo: p.trackingNo,
        carrier: p.carrier,
        status: p.status,
      })),
      diffs,
      summary,
    }
  }

  /**
   * 标记打包（6.7）：将打包任务置为 packed，并把其聚合的采购单（arrived/matched）推进到 packed
   * （内部批量推进，尊重状态机 §6：matched→packed 合法，arrived 一并归位）。幂等：已 packed 直接返回。
   */
  async pack(tenantId: string, packTaskId: string): Promise<PackTaskDto> {
    const task = await this.prisma.packTask.findFirst({ where: { id: packTaskId, tenantId } })
    if (!task) {
      throw new BusinessException('PACK_TASK_NOT_FOUND', '打包任务不存在或无权限', HttpStatus.NOT_FOUND)
    }
    if (task.status !== 'packed') {
      // 聚合采购单推进：只推进 arrived/matched（packed/outbound 保持）
      const poIds = (task.purchaseOrderIds as unknown as string[]) ?? []
      if (poIds.length) {
        await this.prisma.purchaseOrder.updateMany({
          where: { id: { in: poIds }, tenantId, status: { in: ['arrived', 'matched'] } },
          data: { status: 'packed' },
        })
      }
      const updated = await this.prisma.packTask.update({
        where: { id: packTaskId },
        data: { status: 'packed', packedAt: new Date() },
      })
      task.status = updated.status
      task.packedAt = updated.packedAt
    }
    this.logger.log(`[TRANSFER] 标记打包 tenant=${tenantId} task=${packTaskId}`, 'Transfer')
    const order = task.orderId
      ? await this.prisma.order.findFirst({
          where: { id: task.orderId, tenantId },
          select: { id: true, platformOrderNo: true, status: true, recipient: true },
        })
      : null
    const poIds = (task.purchaseOrderIds as unknown as string[]) ?? []
    const pos = poIds.length
      ? await this.prisma.purchaseOrder.findMany({ where: { tenantId, id: { in: poIds } } })
      : []
    const poMap = new Map(pos.map((p) => [p.id, p]))
    return this.toPackTaskDto(task, order, poMap)
  }

  /** 打包任务归一化为前端 DTO（关联订单 + 采购单摘要）。 */
  private toPackTaskDto(
    task: { id: string; tenantId: string; warehouseId: string | null; orderId: string | null; purchaseOrderIds: unknown; status: string; channelCode: string | null; labelId: string | null; shipmentId: string | null; packedAt: Date | null; createdAt: Date },
    order: { id: string; platformOrderNo: string | null; status: string; recipient: unknown } | null | undefined,
    poMap: Map<string, { id: string; trackingNo: string; carrier: string; status: string }>,
  ): PackTaskDto {
    const poIds = (task.purchaseOrderIds as unknown as string[]) ?? []
    return {
      id: task.id,
      tenantId: task.tenantId,
      warehouseId: task.warehouseId,
      orderId: task.orderId,
      purchaseOrderIds: poIds,
      status: task.status,
      channelCode: task.channelCode,
      labelId: task.labelId,
      shipmentId: task.shipmentId,
      packedAt: task.packedAt ? task.packedAt.toISOString() : null,
      createdAt: task.createdAt.toISOString(),
      order: order
        ? {
            id: order.id,
            platformOrderNo: order.platformOrderNo,
            status: order.status,
            recipientName: (order.recipient as { name?: string } | null)?.name ?? null,
          }
        : null,
      purchaseOrders: poIds.map((id) => {
        const p = poMap.get(id)
        return p
          ? { id: p.id, trackingNo: p.trackingNo, carrier: p.carrier, status: p.status }
          : { id, trackingNo: '-', carrier: '-', status: '-' }
      }),
    }
  }

  /**
   * 核对差异核心算法（6.7）：采购行项（含到货）聚合后，与店铺订单行项逐项比对。
   * - matched：SKU 一致且数量一致
   * - qty_mismatch：SKU 一致但数量不符
   * - missing_in_po：订单需求但采购未覆盖（需补采）
   * - extra_in_po：采购到货但订单无需求（多采/需复核）
   * - unverified：订单行项缺 SKU，无法自动核对
   */
  private computeCheck(
    poItems: { skuId: string | null; productName: string; quantity: number }[],
    orderItems: { skuId: string | null; quantity: number }[],
  ): { diffs: PackCheckRow[]; summary: PackTaskCheck['summary'] } {
    // 聚合采购行项：按 skuId（优先）或 产品名 归一
    const poAgg = new Map<string, { name: string; qty: number }>()
    for (const it of poItems) {
      const key = it.skuId ?? it.productName
      if (!key) continue
      const cur = poAgg.get(key) ?? { name: it.productName, qty: 0 }
      cur.qty += it.quantity
      poAgg.set(key, cur)
    }

    const diffs: PackCheckRow[] = []
    let matched = 0
    let qtyMismatch = 0
    let missing = 0
    let extra = 0
    let unverified = 0
    const consumedPoKeys = new Set<string>()

    for (const oi of orderItems) {
      if (!oi.skuId) {
        unverified++
        diffs.push({
          skuId: null,
          name: '（订单行项缺 SKU）',
          orderQty: oi.quantity,
          poQty: 0,
          diff: -oi.quantity,
          status: 'unverified',
          message: '店铺订单行项缺少 SKU，无法与采购单核对，请人工确认',
        })
        continue
      }
      const po = poAgg.get(oi.skuId)
      if (!po) {
        missing++
        diffs.push({
          skuId: oi.skuId,
          name: oi.skuId,
          orderQty: oi.quantity,
          poQty: 0,
          diff: -oi.quantity,
          status: 'missing_in_po',
          message: '店铺订单需求该 SKU，但采购单未覆盖（需补采）',
        })
        continue
      }
      consumedPoKeys.add(oi.skuId)
      const d = po.qty - oi.quantity
      if (d === 0) matched++
      else qtyMismatch++
      diffs.push({
        skuId: oi.skuId,
        name: po.name,
        orderQty: oi.quantity,
        poQty: po.qty,
        diff: d,
        status: d === 0 ? 'matched' : 'qty_mismatch',
        message: d === 0 ? '采购数量与订单一致' : `采购与订单数量不符（差 ${d > 0 ? '+' : ''}${d}）`,
      })
    }

    // 采购到货但订单无对应需求（多采）
    for (const [key, po] of poAgg) {
      if (consumedPoKeys.has(key)) continue
      extra++
      diffs.push({
        skuId: key,
        name: po.name,
        orderQty: 0,
        poQty: po.qty,
        diff: po.qty,
        status: 'extra_in_po',
        message: '采购到货但店铺订单无对应需求（多采 / 需复核）',
      })
    }

    const total = diffs.length
    const hasDifference = qtyMismatch + missing + extra + unverified > 0
    return { diffs, summary: { total, matched, qtyMismatch, missing, extra, unverified, hasDifference } }
  }
}
