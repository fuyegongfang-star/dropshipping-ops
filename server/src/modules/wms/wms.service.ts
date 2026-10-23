/**
 * WMS 服务（任务 2.2 入库/库存/拣货 + 2.3 海外仓模型，方案 §15 海外仓与一件代发）。
 *
 * 基础链路（§15.2）：
 *   - 仓库：国内仓 / 海外仓（type 区分，2.3）→ 海外仓备货是跨境一件代发主流。
 *   - 入库：ASN 到货预报(pending) → 收货质检(received) → 上架(bin + 库存生效)。
 *   - 库存：租户 + 仓库 + SKU + 库位 维度；入库/出库/盘点损益调整（不得为负）。
 *   - 出库：拣货波次(wave) → 生成拣货任务(pending) → 完成(done) 衔接尾程（§14）。
 *
 * 租户隔离：所有读写按 tenantId 过滤；仓库级操作先校验仓库归属（§0/§17）。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'
import {
  CreateWarehouseDto,
  CreateAsnDto,
  PutawayDto,
  AdjustInventoryDto,
  CreateWaveDto,
  WarehouseType,
  AsnStatus,
  PickStatus,
} from './wms.dto'

/** 仓库（归一化返回） */
export interface WarehouseDto {
  id: string
  tenantId: string
  name: string
  type: WarehouseType
  region: string | null
  createdAt: string
}

/** 入库单(ASN)（归一化返回） */
export interface AsnDto {
  id: string
  tenantId: string
  warehouseId: string
  status: AsnStatus
  createdAt: string
}

/** 库存（归一化返回） */
export interface InventoryDto {
  id: string
  tenantId: string
  warehouseId: string
  skuId: string
  binId: string | null
  qty: number
  lockedQty: number
}

/** 拣货任务（归一化返回） */
export interface PickTaskDto {
  id: string
  tenantId: string
  warehouseId: string
  orderId: string | null
  status: PickStatus
  createdAt: string
}

@Injectable()
export class WmsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  // ——— 仓库（2.3 海外仓模型）———

  /** 列出当前租户仓库（国内 / 海外），按创建倒序 */
  async listWarehouses(tenantId: string): Promise<WarehouseDto[]> {
    const rows = await this.prisma.warehouse.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toWarehouseDto(r))
  }

  /** 新建仓库（domestic / overseas） */
  async createWarehouse(tenantId: string, dto: CreateWarehouseDto): Promise<WarehouseDto> {
    if (dto.type === 'overseas' && !dto.region) {
      throw new BusinessException('WAREHOUSE_REGION_REQUIRED', '海外仓必须填写所在国家/区域', HttpStatus.BAD_REQUEST)
    }
    const row = await this.prisma.warehouse.create({
      data: { tenantId, name: dto.name, type: dto.type, region: dto.region ?? null },
    })
    this.logger.log(`[WMS] 创建仓库 ${row.id} (${dto.name}/${dto.type})`, 'Wms')
    return this.toWarehouseDto(row)
  }

  // ——— 入库（ASN → 收货 → 上架）———

  /** 列出当前租户入库单（可按仓库过滤） */
  async listAsns(tenantId: string, warehouseId?: string): Promise<AsnDto[]> {
    const rows = await this.prisma.asn.findMany({
      where: warehouseId ? { tenantId, warehouseId } : { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toAsnDto(r))
  }

  /** 新建入库预报(ASN)：校验仓库归属，初始态 pending */
  async createAsn(tenantId: string, dto: CreateAsnDto): Promise<AsnDto> {
    await this.assertWarehouse(tenantId, dto.warehouseId)
    const row = await this.prisma.asn.create({
      data: { tenantId, warehouseId: dto.warehouseId, status: 'pending' },
    })
    this.logger.log(`[WMS] 创建 ASN ${row.id} → pending`, 'Wms')
    return this.toAsnDto(row)
  }

  /** 收货质检：pending → received */
  async receiveAsn(tenantId: string, asnId: string): Promise<AsnDto> {
    const asn = await this.assertAsn(tenantId, asnId)
    if (asn.status !== 'pending') {
      throw new BusinessException('ASN_INVALID_TRANSITION', '仅 pending 状态的 ASN 可收货', HttpStatus.BAD_REQUEST)
    }
    const updated = await this.prisma.asn.update({ where: { id: asnId }, data: { status: 'received' } })
    this.logger.log(`[WMS] ASN ${asnId} → received`, 'Wms')
    return this.toAsnDto(updated)
  }

  /**
   * 上架：收货实物入到库位并增加库存（§15.2）。
   * 库位不存在则按 binCode 自动建库位；库存按 (仓+SKU+库位) upsert；上架后 ASN → closed。
   */
  async putaway(tenantId: string, asnId: string, dto: PutawayDto): Promise<InventoryDto> {
    const asn = await this.assertAsn(tenantId, asnId)
    if (asn.status === 'closed') {
      throw new BusinessException('ASN_CLOSED', 'ASN 已关闭，不可再次上架', HttpStatus.CONFLICT)
    }
    // 库位：不存在则创建（tenant + warehouse + code 维度）
    let bin = await this.prisma.bin.findFirst({
      where: { tenantId, warehouseId: asn.warehouseId, code: dto.binCode },
    })
    if (!bin) {
      bin = await this.prisma.bin.create({
        data: { tenantId, warehouseId: asn.warehouseId, code: dto.binCode },
      })
    }
    // 库存 upsert：同一 (tenant, warehouse, sku, bin) 累加（用 findFirst + create/update 规避复合唯一键类型约束）
    const invWhere = { tenantId, warehouseId: asn.warehouseId, skuId: dto.skuId, binId: bin.id }
    const existingInv = await this.prisma.inventory.findFirst({ where: invWhere })
    const inv = existingInv
      ? await this.prisma.inventory.update({
          where: { id: existingInv.id },
          data: { qty: { increment: dto.qty } },
        })
      : await this.prisma.inventory.create({
          data: { tenantId, warehouseId: asn.warehouseId, skuId: dto.skuId, binId: bin.id, qty: dto.qty, lockedQty: 0 },
        })
    // 上架完成关闭 ASN（基础版：一次上架即关闭，复杂多件上架可扩展）
    await this.prisma.asn.update({ where: { id: asnId }, data: { status: 'closed' } })
    this.logger.log(`[WMS] ASN ${asnId} 上架 ${dto.qty} 件 SKU ${dto.skuId} → bin ${bin.code}`, 'Wms')
    return this.toInventoryDto(inv)
  }

  // ——— 库存（§15.2）———

  /** 列出当前租户库存（可按仓库过滤） */
  async listInventory(tenantId: string, warehouseId?: string): Promise<InventoryDto[]> {
    const rows = await this.prisma.inventory.findMany({
      where: warehouseId ? { tenantId, warehouseId } : { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toInventoryDto(r))
  }

  /**
   * 库存调整（入库 / 出库 / 盘点损益）：按 (仓+SKU+库位) upsert；
   * 出库(delta<0) 不得使可用库存(qty) 为负，否则诚实抛 INVENTORY_INSUFFICIENT。
   */
  async adjustInventory(tenantId: string, dto: AdjustInventoryDto): Promise<InventoryDto> {
    await this.assertWarehouse(tenantId, dto.warehouseId)
    const where = { tenantId, warehouseId: dto.warehouseId, skuId: dto.skuId, binId: dto.binId ?? null }
    const existing = await this.prisma.inventory.findFirst({ where })
    const currentQty = existing?.qty ?? 0
    const nextQty = currentQty + dto.delta
    if (nextQty < 0) {
      throw new BusinessException(
        'INVENTORY_INSUFFICIENT',
        `库存不足：当前 ${currentQty}，出库 ${Math.abs(dto.delta)} 将使库存为负`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const inv = existing
      ? await this.prisma.inventory.update({ where: { id: existing.id }, data: { qty: nextQty } })
      : await this.prisma.inventory.create({
          data: { tenantId, warehouseId: dto.warehouseId, skuId: dto.skuId, binId: dto.binId ?? null, qty: nextQty, lockedQty: 0 },
        })
    this.logger.log(`[WMS] 库存调整 仓 ${dto.warehouseId} SKU ${dto.skuId} delta ${dto.delta} → ${nextQty}`, 'Wms')
    return this.toInventoryDto(inv)
  }

  // ——— 出库拣货（波次 → 任务）———

  /** 列出当前租户拣货任务（可按仓库过滤） */
  async listPicks(tenantId: string, warehouseId?: string): Promise<PickTaskDto[]> {
    const rows = await this.prisma.pickTask.findMany({
      where: warehouseId ? { tenantId, warehouseId } : { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toPickDto(r))
  }

  /** 创建拣货波次：按订单生成拣货任务（pending） */
  async createWave(tenantId: string, dto: CreateWaveDto): Promise<PickTaskDto[]> {
    await this.assertWarehouse(tenantId, dto.warehouseId)
    const orderIds = dto.orderIds && dto.orderIds.length ? dto.orderIds : []
    const tasks: PickTaskDto[] = []
    for (const orderId of orderIds) {
      const row = await this.prisma.pickTask.create({
        data: { tenantId, warehouseId: dto.warehouseId, orderId, status: 'pending' },
      })
      tasks.push(this.toPickDto(row))
    }
    this.logger.log(`[WMS] 创建拣货波次 仓 ${dto.warehouseId} 任务数 ${tasks.length}`, 'Wms')
    return tasks
  }

  /** 完成拣货任务：pending/picking → done */
  async completePick(tenantId: string, taskId: string): Promise<PickTaskDto> {
    const task = await this.prisma.pickTask.findUnique({ where: { id: taskId } })
    if (!task || task.tenantId !== tenantId) {
      throw new BusinessException('PICK_TASK_NOT_FOUND', '拣货任务不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const updated = await this.prisma.pickTask.update({ where: { id: taskId }, data: { status: 'done' } })
    this.logger.log(`[WMS] 拣货任务 ${taskId} → done`, 'Wms')
    return this.toPickDto(updated)
  }

  // ——— 内部校验助手 ———

  /** 校验仓库归属当前租户 */
  private async assertWarehouse(tenantId: string, warehouseId: string): Promise<void> {
    const wh = await this.prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, tenantId: true } })
    if (!wh || wh.tenantId !== tenantId) {
      throw new BusinessException('WAREHOUSE_NOT_FOUND', '仓库不存在或无权限', HttpStatus.NOT_FOUND)
    }
  }

  /** 校验 ASN 归属当前租户并返回 */
  private async assertAsn(tenantId: string, asnId: string): Promise<AsnDto & { status: AsnStatus }> {
    const asn = await this.prisma.asn.findUnique({ where: { id: asnId } })
    if (!asn || asn.tenantId !== tenantId) {
      throw new BusinessException('ASN_NOT_FOUND', '入库单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    return this.toAsnDto(asn)
  }

  private toWarehouseDto(r: Prisma.WarehouseGetPayload<object>): WarehouseDto {
    return { id: r.id, tenantId: r.tenantId, name: r.name, type: r.type as WarehouseType, region: r.region, createdAt: r.createdAt.toISOString() }
  }
  private toAsnDto(r: Prisma.AsnGetPayload<object>): AsnDto {
    return { id: r.id, tenantId: r.tenantId, warehouseId: r.warehouseId, status: r.status as AsnStatus, createdAt: r.createdAt.toISOString() }
  }
  private toInventoryDto(r: Prisma.InventoryGetPayload<object>): InventoryDto {
    return { id: r.id, tenantId: r.tenantId, warehouseId: r.warehouseId, skuId: r.skuId, binId: r.binId, qty: r.qty, lockedQty: r.lockedQty }
  }
  private toPickDto(r: Prisma.PickTaskGetPayload<object>): PickTaskDto {
    return { id: r.id, tenantId: r.tenantId, warehouseId: r.warehouseId, orderId: r.orderId, status: r.status as PickStatus, createdAt: r.createdAt.toISOString() }
  }
}
