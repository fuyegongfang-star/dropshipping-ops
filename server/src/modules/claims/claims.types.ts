import { IsDecimal, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

/**
 * 理赔类型与状态（任务 4.8，方案 §20 异常 / 理赔 / 保险）。
 * 与 Prisma `Claim` 模型字段对齐；为提升演示与测试可读性，amount 在接口层以 number 表达（DB 为 Decimal）。
 */

/** 异常分类：丢件 / 破损 / 延误 / 清关失败 / 拒收 / 地址错误（§20） */
export type ClaimType = 'lost' | 'damage' | 'delay' | 'customs_fail' | 'reject' | 'address_error'
/** 理赔状态：待处理 → 处理中 → 通过/驳回 →（通过）已赔付 */
export type ClaimStatus = 'open' | 'processing' | 'approved' | 'rejected' | 'paid'
/** 责任方：承运商 / 平台 / 保险 */
export type ClaimResponsibleParty = 'carrier' | 'platform' | 'insurer'

/** 理赔输出（接口层形状） */
export interface ClaimOut {
  id: string
  tenantId: string
  shipmentId: string
  type: ClaimType
  cause: string | null
  status: ClaimStatus
  amount: number | null
  responsibleParty: ClaimResponsibleParty | null
  refCarrierClaimId: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

/** 新建理赔（运单 + 类型必填；金额 / 责任方 / 承运商理赔号可选） */
export class CreateClaimDto {
  @IsString()
  shipmentId!: string

  @IsEnum(['lost', 'damage', 'delay', 'customs_fail', 'reject', 'address_error'])
  type!: ClaimType

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cause?: string

  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  amount?: string

  @IsOptional()
  @IsEnum(['carrier', 'platform', 'insurer'])
  responsibleParty?: ClaimResponsibleParty

  @IsOptional()
  @IsString()
  refCarrierClaimId?: string
}

/** 推进理赔状态（§20 流转：open→processing→approved/rejected→paid） */
export class UpdateClaimStatusDto {
  @IsEnum(['open', 'processing', 'approved', 'rejected', 'paid'])
  status!: ClaimStatus

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}
