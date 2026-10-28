/**
 * WMS（仓储 / 海外仓）DTO（任务 2.2/2.3，方案 §15 海外仓与一件代发）。
 * 入口参数校验：仓库、入库预报(ASN)、上架、库存调整、拣货波次。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-23
 */

import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator'

/** 仓库类型：国内仓 / 海外仓 / 中转仓（阶段6 货代中转仓作业流 6.5） */
export type WarehouseType = 'domestic' | 'overseas' | 'transfer'

/** 入库单(ASN)状态：待收货 / 已收货 / 已关闭 */
export type AsnStatus = 'pending' | 'received' | 'closed'

/** 拣货任务状态：待拣 / 拣货中 / 已完成 */
export type PickStatus = 'pending' | 'picking' | 'done'

/** 新建仓库 */
export class CreateWarehouseDto {
  @IsString()
  @IsNotEmpty()
  name: string // 仓库名称（如「深圳前海仓」「US-West 海外仓」「深圳福永中转仓」）

  @IsIn(['domestic', 'overseas', 'transfer'])
  type: WarehouseType // 仓库类型：国内 / 海外（§15）/ 中转仓（阶段6 6.5）

  @IsOptional()
  @IsString()
  region?: string // 区域 / 国家（海外仓必填国家；中转仓可填城市/口岸）
}

/** 新建库位（货架编号） */
export class CreateBinDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string // 所属仓库（必须属于当前租户）

  @IsString()
  @IsNotEmpty()
  code: string // 库位编码（货架编号，如 A-01-02）

  @IsOptional()
  @IsString()
  zone?: string // 库区（可选，如 A 区 / 拣货区）
}

/** 新建入库预报(ASN) */
export class CreateAsnDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string // 目标仓库（必须属于当前租户）
}

/** 上架：把收货实物入到库位并增加库存 */
export class PutawayDto {
  @IsString()
  @IsNotEmpty()
  skuId: string // 内部 SKU ID

  @IsInt()
  @Min(1)
  qty: number // 上架数量（≥1）

  @IsString()
  @IsNotEmpty()
  binCode: string // 库位编码（不存在则自动建库位）
}

/** 库存调整（入库 / 出库 / 盘点损益） */
export class AdjustInventoryDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string

  @IsString()
  @IsNotEmpty()
  skuId: string

  @IsInt()
  delta: number // 数量变动：正=入库，负=出库（出库不得使库存为负）

  @IsOptional()
  @IsString()
  binId?: string // 库位（缺省走该仓库该 SKU 的默认行）
}

/** 创建拣货波次（按订单生成拣货任务） */
export class CreateWaveDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string

  orderIds?: string[] // 波次包含的订单（生成对应拣货任务）
}

/** 库位（货架编号，归一化返回） */
export interface BinDto {
  id: string
  tenantId: string
  warehouseId: string
  warehouseName: string
  code: string
  zone: string | null
  /** 占用：该库位上的 SKU 种类数 */
  skuKinds: number
  /** 占用：该库位上的库存总量 */
  totalQty: number
  createdAt: string
}
