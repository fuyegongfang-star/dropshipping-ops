/**
 * 供应商代发服务（任务 1.9 基础链路，方案 §21 供应商代发）。
 *
 * 基础链路：平台订单 → 生成供应商代发单（推单）→ 供应商接单/发货/完成，状态机驱动。
 * 状态机：pushed → accepted → shipped → done（向前推进，done 为终态）。
 * 租户隔离：所有读写按 tenantId 过滤（§0/§17）。
 *
 * 注：完整 §21 还含供应商对账/结算（SupplierSettlement），本任务只落地「基础链路」，
 * 对账/结算归入后续财务模块扩展。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-21
 */

import { Injectable, HttpStatus } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'
import { BusinessException } from '../../common/response/business.exception'
import { AppLogger } from '../../common/logger/app.logger'

/** 供应商代发单状态（§21 基础链路状态机） */
export type SupplierOrderStatus = 'pushed' | 'accepted' | 'shipped' | 'done'

/** 状态前进顺序（用于校验一步推进） */
const STATUS_FLOW: SupplierOrderStatus[] = ['pushed', 'accepted', 'shipped', 'done']

/** 创建供应商代发单入参 */
export interface CreateSupplierOrderInput {
  supplierId: string
  orderId?: string
}

/** 供应商代发单（归一化返回） */
export interface SupplierOrderDto {
  id: string
  tenantId: string
  supplierId: string
  orderId: string | null
  status: SupplierOrderStatus
  createdAt: string
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: AppLogger,
  ) {}

  /** 列出当前租户的供应商代发单（按创建时间倒序，§17 隔离） */
  async list(tenantId: string): Promise<SupplierOrderDto[]> {
    const rows = await this.prisma.supplierOrder.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.toDto(r))
  }

  /** 创建供应商代发单（推单，初始态 pushed，§21） */
  async create(tenantId: string, input: CreateSupplierOrderInput): Promise<SupplierOrderDto> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true, tenantId: true },
    })
    if (!supplier || supplier.tenantId !== tenantId) {
      throw new BusinessException('SUPPLIER_NOT_FOUND', '供应商不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const row = await this.prisma.supplierOrder.create({
      data: { tenantId, supplierId: input.supplierId, orderId: input.orderId ?? null, status: 'pushed' },
    })
    this.logger.log(`[Supplier] 创建代发单 ${row.id} → pushed`, 'Suppliers')
    return this.toDto(row)
  }

  /**
   * 推进状态（一步前进或直达 done，§21 状态机）。
   * 终态 done 不可再变更；非法跳步/回退抛 SUPPLIER_ORDER_INVALID_TRANSITION。
   */
  async advance(tenantId: string, id: string, to: SupplierOrderStatus): Promise<SupplierOrderDto> {
    const row = await this.prisma.supplierOrder.findUnique({ where: { id } })
    if (!row || row.tenantId !== tenantId) {
      throw new BusinessException('SUPPLIER_ORDER_NOT_FOUND', '代发单不存在或无权限', HttpStatus.NOT_FOUND)
    }
    const from = row.status as SupplierOrderStatus
    if (from === 'done') {
      throw new BusinessException('SUPPLIER_ORDER_FINAL', '代发单已处于终态 done，不可变更', HttpStatus.CONFLICT)
    }
    const fromIdx = STATUS_FLOW.indexOf(from)
    const toIdx = STATUS_FLOW.indexOf(to)
    if (toIdx <= fromIdx) {
      throw new BusinessException(
        'SUPPLIER_ORDER_INVALID_TRANSITION',
        `非法状态推进：${from} → ${to}（仅允许向前一步或直达 done）`,
        HttpStatus.BAD_REQUEST,
      )
    }
    const updated = await this.prisma.supplierOrder.update({
      where: { id },
      data: { status: to },
    })
    this.logger.log(`[Supplier] 代发单 ${id} ${from} → ${to}`, 'Suppliers')
    return this.toDto(updated)
  }

  private toDto(r: Prisma.SupplierOrderGetPayload<object>): SupplierOrderDto {
    return {
      id: r.id,
      tenantId: r.tenantId,
      supplierId: r.supplierId,
      orderId: r.orderId,
      status: r.status as SupplierOrderStatus,
      createdAt: r.createdAt.toISOString(),
    }
  }
}
