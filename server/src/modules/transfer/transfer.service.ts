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
import { ShipmentsService } from '../shipments/shipments.service'
import { ScanTransferDto, GenerateLabelDto, OutboundTransferDto } from './transfer.dto'
import { ScanKind, SCAN_KIND_LABELS, guessScanKind, normalizeScanValue, scanMissHint } from './scan-rules'
import type {
  PackQueueItem,
  PackTaskDto,
  PackCheckRow,
  PackTaskCheck,
  ChannelOption,
  ShippingLabelDto,
  PackLabelResult,
} from './transfer.types'

// 待作业采购单状态：已到仓 → 已匹配 → 已打包，尚未出库（outbound 即离开中转仓）。
const PENDING_PO_STATUSES = ['arrived', 'matched', 'packed']

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly poService: PurchaseOrderService,
    private readonly shipments?: ShipmentsService,
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
        remark: po.remark ?? null,
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
    purchaseOrder: {
      id: string
      trackingNo: string
      carrier: string
      status: string
      orderId: string | null
      remark: string | null
    }
    matched: boolean
    advanced: boolean
    /** 实际判定的语义类型（auto 模式下由规则引擎得出） */
    resolvedType: ScanKind
    /** 识别结果的人类可读说明（如「EAN-13 商品条码」） */
    resolvedLabel: string
    message: string
  }> {
    // 1) 校验中转仓归属（租户隔离，防越权）
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, tenantId },
    })
    if (!warehouse) {
      throw new BusinessException('WAREHOUSE_NOT_FOUND', '中转仓不存在或无权限', HttpStatus.NOT_FOUND)
    }

    // 2) 按扫码类型解析采购单（6.12：auto 走条码规则引擎，查询优先 + 号段兜底）
    const resolved = await this.resolvePurchaseOrder(tenantId, dto)
    const po = resolved.po
    if (!po) {
      throw new BusinessException(
        'SCAN_NO_PURCHASE_ORDER',
        `${scanMissHint(dto.scanValue)}，请核对${resolved.tried.join(' / ')}`,
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
        // 记录「实际判定的语义类型」而非请求里的 auto，便于事后统计各扫码维度的使用情况
        scanSource: resolved.kind,
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
    // 任务 6.10：录入时已选单关联（orderId 非空）的采购单直接视为已匹配，不再重复自动匹配。
    let matched = !!latestPo.orderId
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
        remark: latestPo.remark ?? null, // 扫码即见分拣/打包注意事项（任务 6.10）
      },
      matched,
      advanced,
      // 6.12：回传实际识别结果，前端可提示「识别为快递单号」，现场不必猜
      resolvedType: resolved.kind,
      resolvedLabel: resolved.label,
      message: advanced
        ? `到货登记成功，采购单 ${po.trackingNo} 已转为 arrived`
        : `到货登记成功（采购单当前状态 ${latestPo.status}）`,
    }
  }

  /** 按扫码类型解析采购单（快递单号 / SKU 条码 / 采购单号），均限定租户。 */
  /**
   * 按扫码值解析采购单（6.12 解析层）。
   * - `auto`：查询优先，依次尝试 快递单号 → 商品条码 → 采购单号，谁命中算谁；
   *   全不命中时用号段规则给出「最可能类型」以便现场排查（EAN-13 与 13 位快递单号文本上
   *   不可区分，纯正则无法判定，故必须以查库为准）。
   * - 指定类型：只走对应分支（人工兜底，用于号段冲突时人工裁决）。
   */
  private async resolvePurchaseOrder(
    tenantId: string,
    dto: ScanTransferDto,
  ): Promise<{
    po: Prisma.PurchaseOrderGetPayload<{ include: { items: true } }> | null
    kind: ScanKind
    label: string
    /** 本次实际尝试过的解析维度，用于未命中时的错误提示 */
    tried: string[]
  }> {
    const value = normalizeScanValue(dto.scanValue)

    const byTracking = async () =>
      this.prisma.purchaseOrder.findFirst({ where: { tenantId, trackingNo: value }, include: { items: true } })

    const byPurchaseNo = async () =>
      this.prisma.purchaseOrder.findFirst({
        where: { tenantId, OR: [{ id: value }, { purchaseNo: value }] },
        include: { items: true },
      })

    /**
     * 商品条码 → SKU → 采购单。
     * 注意：扫码枪扫出来的是 Sku.barcode（如 EAN-13），而不是内部 skuId(cuid)；
     * 6.6 原实现误用 skuId 匹配导致条码扫码必然落空，此处修正为走 Sku.barcode。
     */
    const byBarcode = async () => {
      const sku = await this.prisma.sku.findFirst({ where: { tenantId, barcode: value }, select: { id: true } })
      if (!sku) return null
      const item = await this.prisma.purchaseOrderItem.findFirst({
        where: { skuId: sku.id, purchaseOrder: { tenantId } },
        include: { purchaseOrder: true },
      })
      if (!item?.purchaseOrder) return null
      return this.prisma.purchaseOrder.findFirst({
        where: { id: item.purchaseOrder.id, tenantId },
        include: { items: true },
      })
    }

    // —— 人工指定类型：只走对应分支 ——
    if (dto.scanType === 'trackingNo') {
      return { po: await byTracking(), kind: 'trackingNo', label: SCAN_KIND_LABELS.trackingNo, tried: ['快递单号'] }
    }
    if (dto.scanType === 'purchaseNo') {
      return { po: await byPurchaseNo(), kind: 'purchaseNo', label: SCAN_KIND_LABELS.purchaseNo, tried: ['采购单号'] }
    }
    if (dto.scanType === 'barcode') {
      return { po: await byBarcode(), kind: 'barcode', label: SCAN_KIND_LABELS.barcode, tried: ['商品条码'] }
    }

    // —— auto：查询优先（顺序按命中率高低：快递单号 > 商品条码 > 采购单号）——
    const tried: string[] = []
    let po = await byTracking()
    tried.push('快递单号')
    if (po) return { po, kind: 'trackingNo', label: SCAN_KIND_LABELS.trackingNo, tried }

    po = await byBarcode()
    tried.push('商品条码')
    if (po) return { po, kind: 'barcode', label: SCAN_KIND_LABELS.barcode, tried }

    po = await byPurchaseNo()
    tried.push('采购单号')
    if (po) return { po, kind: 'purchaseNo', label: SCAN_KIND_LABELS.purchaseNo, tried }

    // 全未命中：用号段规则给提示（不抛错，交由调用方决定）
    const guessed = guessScanKind(value)
    return { po: null, kind: guessed.kind, label: guessed.label, tried }
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
          remark: p.remark ?? null,
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
        remark: p.remark ?? null,
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
    poMap: Map<string, { id: string; trackingNo: string; carrier: string; status: string; remark: string | null }>,
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
          ? {
              id: p.id,
              trackingNo: p.trackingNo,
              carrier: p.carrier,
              status: p.status,
              remark: p.remark ?? null,
            }
          : { id, trackingNo: '-', carrier: '-', status: '-', remark: null }
      }),
    }
  }

  // ===== 6.8 跨境面单生成（中转仓出单）=====

  /** 可选跨境渠道（演示态）。生产应经比价/履约路由 1.5 + 承运商适配器真实建单。 */
  private static readonly CHANNELS: ChannelOption[] = [
    { code: 'yunexpress', name: '云途物流', currency: 'CNY', baseFee: 18, perKgRate: 42 },
    { code: 'dhl', name: 'DHL', currency: 'CNY', baseFee: 35, perKgRate: 68 },
    { code: '4px', name: '递四方 4PX', currency: 'CNY', baseFee: 16, perKgRate: 38 },
    { code: 'yanwen', name: '燕文物流', currency: 'CNY', baseFee: 14, perKgRate: 35 },
  ]

  /** 列出可选跨境渠道（6.8）。 */
  listChannels(): ChannelOption[] {
    return TransferService.CHANNELS
  }

  /**
   * 生成跨境面单（6.8）：仅已打包的打包任务可执行。流程——
   * 选渠道 → 估算运费（演示价，TODO 接 MarkupEngineService §10）→ 本地建单落库 Shipment + 首条轨迹
   * → 生成 ZPL 源文与 SVG 预览面单 → 回填 PackTask.channelCode/labelId/shipmentId。
   * 幂等：已生成面单直接返回既有面单。
   */
  async generateLabel(
    tenantId: string,
    packTaskId: string,
    dto: GenerateLabelDto,
  ): Promise<PackLabelResult> {
    const task = await this.prisma.packTask.findFirst({ where: { id: packTaskId, tenantId } })
    if (!task) {
      throw new BusinessException('PACK_TASK_NOT_FOUND', '打包任务不存在或无权限', HttpStatus.NOT_FOUND)
    }
    // 幂等：已生成面单则直接返回
    if (task.labelId) {
      const existing = await this.prisma.shippingLabel.findFirst({
        where: { id: task.labelId, tenantId },
      })
      if (existing) {
        const { order, poMap } = await this.loadTaskContext(tenantId, task)
        return { packTask: this.toPackTaskDto(task, order, poMap), label: this.toLabelDto(existing) }
      }
    }
    if (task.status !== 'packed') {
      throw new BusinessException(
        'PACK_TASK_NOT_PACKED',
        '仅已打包的打包任务可生成跨境面单，请先标记打包',
        HttpStatus.BAD_REQUEST,
      )
    }
    if (!task.orderId) {
      throw new BusinessException('PACK_TASK_INVALID', '该打包任务缺少关联订单，无法出单', HttpStatus.BAD_REQUEST)
    }
    const channel = TransferService.CHANNELS.find((c) => c.code === dto.channelCode)
    if (!channel) {
      throw new BusinessException('CHANNEL_NOT_SUPPORTED', '不支持的跨境渠道', HttpStatus.BAD_REQUEST)
    }

    const order = await this.prisma.order.findFirst({
      where: { id: task.orderId, tenantId },
      select: { id: true, platformOrderNo: true, status: true, recipient: true },
    })
    const poIds = (task.purchaseOrderIds as unknown as string[]) ?? []
    const pos = poIds.length
      ? await this.prisma.purchaseOrder.findMany({
          where: { tenantId, id: { in: poIds } },
          include: { items: true },
        })
      : []

    // 实重（克）：聚合采购行项 SKU 计费重
    let weightG = 0
    for (const p of pos) {
      for (const it of p.items) {
        if (it.skuId) {
          const sku = await this.prisma.sku.findUnique({ where: { id: it.skuId } })
          if (sku) weightG += (sku.weightG ?? 0) * it.quantity
        }
      }
    }
    const { carrierCost, sellPrice } = this.estimateCost(channel, weightG)
    const trackingNo = `${channel.code.toUpperCase()}-${Date.now().toString(36).toUpperCase()}${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, '0')}`

    // 本地建单（演示态）：真实承运商建单需凭证，TODO 6.8 联调后经承运商适配器出单
    const shipment = await this.prisma.shipment.create({
      data: {
        tenantId,
        orderId: task.orderId as string,
        purchaseOrderId: poIds[0] ?? null,
        carrierId: null,
        trackingNo,
        status: 'booked',
        carrierCost: new Prisma.Decimal(carrierCost),
        sellPrice: new Prisma.Decimal(sellPrice),
      },
    })
    await this.prisma.shipmentLeg.create({
      data: {
        tenantId,
        shipmentId: shipment.id,
        legType: 'direct',
        carrierId: null,
        trackingNo,
        status: 'booked',
      },
    })
    await this.prisma.trackingEvent.create({
      data: {
        tenantId,
        shipmentId: shipment.id,
        status: 'booked',
        location: '中转仓',
        description: `已向 ${channel.name} 下单（中转仓出单）`,
        occurredAt: new Date(),
      },
    })

    const recipient = (order?.recipient as Record<string, unknown>) ?? {}
    const zpl = this.buildZpl(channel, trackingNo, order, pos, weightG)
    const pdfUrl = this.buildLabelSvg(channel, trackingNo, order, pos, weightG)
    const label = await this.prisma.shippingLabel.create({
      data: {
        tenantId,
        packTaskId: task.id,
        shipmentId: shipment.id,
        channelCode: channel.code,
        trackingNo,
        recipient: (recipient as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        zpl,
        pdfUrl,
        status: 'created',
      },
    })
    await this.prisma.packTask.update({
      where: { id: task.id },
      data: { channelCode: channel.code, labelId: label.id, shipmentId: shipment.id },
    })
    this.logger.log(
      `[TRANSFER] 生成跨境面单 tenant=${tenantId} task=${packTaskId} channel=${channel.code} tracking=${trackingNo}`,
      'Transfer',
    )
    const refreshed = (await this.prisma.packTask.findFirst({ where: { id: task.id, tenantId } }))!
    const { order: refreshedOrder, poMap } = await this.loadTaskContext(tenantId, refreshed)
    return {
      packTask: this.toPackTaskDto(refreshed, refreshedOrder, poMap),
      label: this.toLabelDto(label),
    }
  }

  /** 查看跨境面单（6.8）：返回已生成的面单（ZPL + 预览）。 */
  async getLabel(tenantId: string, packTaskId: string): Promise<ShippingLabelDto> {
    const task = await this.prisma.packTask.findFirst({ where: { id: packTaskId, tenantId } })
    if (!task) {
      throw new BusinessException('PACK_TASK_NOT_FOUND', '打包任务不存在或无权限', HttpStatus.NOT_FOUND)
    }
    if (!task.labelId) {
      throw new BusinessException('LABEL_NOT_FOUND', '该打包任务尚未生成跨境面单', HttpStatus.NOT_FOUND)
    }
    const label = await this.prisma.shippingLabel.findFirst({ where: { id: task.labelId, tenantId } })
    if (!label) {
      throw new BusinessException('LABEL_NOT_FOUND', '面单记录不存在', HttpStatus.NOT_FOUND)
    }
    return this.toLabelDto(label)
  }

  /** 加载打包任务关联订单与采购单映射（供 DTO 归一）。 */
  private async loadTaskContext(
    tenantId: string,
    task: { id: string; tenantId: string; orderId: string | null; purchaseOrderIds: unknown },
  ): Promise<{
    order: { id: string; platformOrderNo: string | null; status: string; recipient: unknown } | null
    poMap: Map<string, { id: string; trackingNo: string; carrier: string; status: string; remark: string | null }>
  }> {
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
    return { order, poMap }
  }

  /** 演示运费估算（CNY）：基础费 + 每公斤费率 × 实重（最低 0.5kg）。生产应经 MarkupEngineService §10。 */
  private estimateCost(channel: ChannelOption, weightG: number): { carrierCost: number; sellPrice: number } {
    const weightKg = Math.max(weightG / 1000, 0.5)
    const carrierCost = Number((channel.baseFee + channel.perKgRate * weightKg).toFixed(2))
    const sellPrice = Number((carrierCost * 1.15 + 5).toFixed(2)) // 演示加价 15% + 最低毛利 ¥5
    return { carrierCost, sellPrice }
  }

  /** 生成 ZPL 标签源文（供 ZPL 打印机 / 打印）。 */
  private buildZpl(
    channel: ChannelOption,
    trackingNo: string,
    order: { recipient: unknown } | null,
    pos: { items: { productName: string; quantity: number }[] }[],
    weightG: number,
  ): string {
    const rec = (order?.recipient as Record<string, unknown>) ?? {}
    const name = (rec.name as string) ?? ''
    const country = (rec.country as string) ?? ''
    const city = (rec.city as string) ?? ''
    const items = pos.flatMap((p) => p.items.map((i) => `${i.productName} x${i.quantity}`)).join(' / ')
    return [
      '^XA',
      '^FO20,20^ADN,18,10^FD跨境物流面单^FS',
      `^FO20,55^ADN,12,8^FD渠道: ${channel.name} (${channel.code})^FS`,
      `^FO20,80^ADN,12,8^FD运单号: ${trackingNo}^FS`,
      `^FO20,105^ADN,12,8^FD收件人: ${name} / ${country} ${city}^FS`,
      `^FO20,130^ADN,10,7^FD商品: ${items}^FS`,
      `^FO20,155^ADN,10,7^FD实重: ${(weightG / 1000).toFixed(2)} kg^FS`,
      '^BY3,2,60',
      `^FO20,185^BCN,60,Y,N,N^FD${trackingNo}^FS`,
      `^FO20,260^ADN,10,7^FD${channel.name} CROSS-BORDER LABEL^FS`,
      '^XZ',
    ].join('\n')
  }

  /** 生成 SVG 预览面单，返回 data URI（演示预览；生产替换为 PDF）。 */
  private buildLabelSvg(
    channel: ChannelOption,
    trackingNo: string,
    order: { recipient: unknown } | null,
    pos: { items: { productName: string; quantity: number }[] }[],
    weightG: number,
  ): string {
    const rec = (order?.recipient as Record<string, unknown>) ?? {}
    const name = this.escapeHtml((rec.name as string) ?? '')
    const country = this.escapeHtml((rec.country as string) ?? '')
    const city = this.escapeHtml((rec.city as string) ?? '')
    const addr = this.escapeHtml((rec.address1 as string) ?? '')
    const zip = this.escapeHtml((rec.zip as string) ?? '')
    const itemsStr = this.escapeHtml(
      pos.flatMap((p) => p.items.map((i) => `${i.productName} x${i.quantity}`)).join(' / ') || '—',
    )
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <rect width="400" height="600" fill="#fff" stroke="#111" stroke-width="2"/>
  <rect x="0" y="0" width="400" height="54" fill="#1e293b"/>
  <text x="16" y="34" fill="#fff" font-size="20" font-family="sans-serif">跨境物流面单 · ${this.escapeHtml(channel.name)}</text>
  <text x="16" y="86" fill="#0f172a" font-size="15" font-family="sans-serif">运单号: ${this.escapeHtml(trackingNo)}</text>
  <text x="16" y="116" fill="#0f172a" font-size="14" font-family="sans-serif">渠道: ${this.escapeHtml(channel.code)}</text>
  <line x1="16" y1="132" x2="384" y2="132" stroke="#cbd5e1"/>
  <text x="16" y="160" fill="#0f172a" font-size="15" font-family="sans-serif">收件人: ${name}</text>
  <text x="16" y="186" fill="#334155" font-size="12" font-family="sans-serif">${country} ${city} ${addr} ${zip}</text>
  <text x="16" y="218" fill="#0f172a" font-size="14" font-family="sans-serif">商品明细:</text>
  <text x="16" y="242" fill="#334155" font-size="12" font-family="sans-serif">${itemsStr}</text>
  <line x1="16" y1="520" x2="384" y2="520" stroke="#cbd5e1"/>
  <text x="16" y="546" fill="#0f172a" font-size="14" font-family="sans-serif">实重: ${(weightG / 1000).toFixed(2)} kg</text>
  <rect x="16" y="556" width="368" height="32" fill="#f1f5f9"/>
  <text x="24" y="578" fill="#475569" font-size="12" font-family="monospace">${this.escapeHtml(trackingNo)}</text>
</svg>`
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
  }

  /** HTML 转义（标签预览内容安全）。 */
  private escapeHtml(s: string): string {
    return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string)
  }

  /** 面单归一化为前端 DTO。 */
  private toLabelDto(label: {
    id: string
    tenantId: string
    packTaskId: string | null
    shipmentId: string | null
    channelCode: string
    trackingNo: string | null
    recipient: unknown
    zpl: string
    pdfUrl: string | null
    status: string
    createdAt: Date
  }): ShippingLabelDto {
    return {
      id: label.id,
      tenantId: label.tenantId,
      packTaskId: label.packTaskId,
      shipmentId: label.shipmentId,
      channelCode: label.channelCode,
      trackingNo: label.trackingNo,
      recipient: (label.recipient as Record<string, unknown>) ?? null,
      zpl: label.zpl,
      pdfUrl: label.pdfUrl,
      status: label.status,
      createdAt: label.createdAt.toISOString(),
    }
  }

  // ===== 6.9 出库闭环 + 物流同步 =====

  /**
   * 出库闭环（6.9）：中转仓打包出单完成后，扫码/点击出库，把跨境运单真正推入干线物流。
   * 流程：
   *  1) 定位运单（优先按打包任务 packTaskId → 取 shipmentId；或直接 shipmentId）；校验已出单（labelId 就绪）。
   *  2) ShipmentsService.fulfill —— 回写销售渠道（pushFulfillment）+ 推进订单 approved→pushed（best-effort）。
   *  3) 追加「出库揽收」轨迹节点 picked_up —— 驱动订单状态机 pushed→picked_up，正式进入跨境物流。
   *  4) 关联采购单状态机推进 packed → outbound（离仓），全部租户隔离（§17 防越权）。
   *  5) 聚合返回：打包任务快照 / 运单 / 完整轨迹时间线 / 采购单状态 / 关联订单状态，供「物流轨迹」页持续跟踪。
   */
  async outbound(tenantId: string, dto: OutboundTransferDto): Promise<import('./transfer.types').OutboundResult> {
    // 1) 解析运单：优先打包任务，否则直接用 shipmentId
    let shipmentId: string | null = dto.shipmentId ?? null
    let task: {
      id: string
      tenantId: string
      orderId: string | null
      purchaseOrderIds: unknown
      status: string
      channelCode: string | null
      labelId: string | null
      shipmentId: string | null
    } | null = null

    if (dto.packTaskId) {
      task = await this.prisma.packTask.findFirst({ where: { id: dto.packTaskId, tenantId } })
      if (!task) {
        throw new BusinessException('PACK_TASK_NOT_FOUND', '打包任务不存在或无权限', HttpStatus.NOT_FOUND)
      }
      // 出库前置：必须已生成跨境面单（labelId/shipmentId 就绪），否则不允许出库。
      if (!task.labelId || !task.shipmentId) {
        throw new BusinessException(
          'OUTBOUND_NO_LABEL',
          '该打包任务尚未生成跨境面单，请先出单再出库',
          HttpStatus.BAD_REQUEST,
        )
      }
      shipmentId = task.shipmentId
    }
    if (!shipmentId) {
      throw new BusinessException('OUTBOUND_TARGET_REQUIRED', '请提供 packTaskId 或 shipmentId', HttpStatus.BAD_REQUEST)
    }

    // 2) 回传平台（推进订单至 pushed）+ 3) 出库揽收节点（推进订单至 picked_up）
    await this.shipments!.fulfill(shipmentId, tenantId)
    await this.shipments!.recordTracking(
      {
        shipmentId,
        status: 'picked_up',
        location: '中转仓',
        description: '已出库揽收，离港进入正式跨境物流',
      },
      tenantId,
    )

    // 4) 采购单状态机推进：packed → outbound（离仓）
    const poIds = (task?.purchaseOrderIds as unknown as string[] | undefined) ?? []
    if (poIds.length) {
      await this.prisma.purchaseOrder.updateMany({
        where: { id: { in: poIds }, tenantId, status: 'packed' },
        data: { status: 'outbound' },
      })
    }

    // 5) 聚合返回
    const shipment = await this.prisma.shipment.findFirst({ where: { id: shipmentId, tenantId } })
    if (!shipment) {
      throw new BusinessException('SHIPMENT_NOT_FOUND', '跨境运单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const tracking = await this.shipments!.listTracking(shipmentId, tenantId)
    const order = shipment.orderId
      ? await this.prisma.order.findFirst({ where: { id: shipment.orderId } })
      : null
    const pos = poIds.length
      ? await this.prisma.purchaseOrder.findMany({ where: { id: { in: poIds }, tenantId } })
      : []
    const poMap = new Map(
      pos.map((p) => [
        p.id,
        {
          id: p.id,
          trackingNo: p.trackingNo,
          carrier: p.carrier,
          status: p.status,
          remark: p.remark ?? null,
        },
      ]),
    )
    const refreshedTask = task
      ? await this.prisma.packTask.findFirst({ where: { id: task.id, tenantId } })
      : null

    this.logger.log(
      `[TRANSFER] 出库闭环 tenant=${tenantId} shipment=${shipmentId} tracking=${shipment.trackingNo} order=${order?.id ?? '-'} poCount=${pos.length}`,
      'Transfer',
    )

    return {
      packTask: refreshedTask ? this.toPackTaskDto(refreshedTask, order, poMap) : null,
      shipment: {
        id: shipment.id,
        trackingNo: shipment.trackingNo ?? null,
        status: shipment.status,
        channelCode: task?.channelCode ?? null,
      },
      tracking: tracking.map((e) => ({
        id: e.id,
        shipmentId: e.shipmentId,
        legType: e.legType ?? undefined,
        status: e.status,
        location: e.location ?? undefined,
        description: e.description ?? undefined,
        occurredAt: e.occurredAt,
      })),
      purchaseOrder: pos.map((p) => ({ id: p.id, status: p.status })),
      order: order ? { id: order.id, status: order.status } : null,
      message: `出库成功：跨境运单 ${shipment.trackingNo ?? ''} 已回传平台并揽收，关联采购单已离仓`,
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
