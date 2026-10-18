import http from './http'

/**
 * 理赔 / 保险接口封装（任务 4.8，方案 §20 异常 / 理赔 / 保险）。
 * 对接后端 /claims/*；演示模式由 mock-data.ts 返回等价数据（同口径聚合）。
 * 字段形状严格对齐后端 claims.types.ts 的 ClaimOut / DTO。
 */

/** 异常分类：丢件 / 破损 / 延误 / 清关失败 / 拒收 / 地址错误（§20） */
export type ClaimType = 'lost' | 'damage' | 'delay' | 'customs_fail' | 'reject' | 'address_error'
/** 理赔状态：待处理 → 处理中 → 通过/驳回 →（通过）已赔付 */
export type ClaimStatus = 'open' | 'processing' | 'approved' | 'rejected' | 'paid'
/** 责任方：承运商 / 平台 / 保险 */
export type ClaimResponsibleParty = 'carrier' | 'platform' | 'insurer'

/** 理赔输出（接口层形状，与后端 ClaimOut 对齐） */
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
export interface CreateClaimDto {
  shipmentId: string
  type: ClaimType
  cause?: string
  /** 金额以字符串传入（后端 Decimal 校验要求字符串），视图侧由 number 转换。 */
  amount?: string
  responsibleParty?: ClaimResponsibleParty
  refCarrierClaimId?: string
}

/** 推进理赔状态（§20 流转：open→processing→approved/rejected→paid） */
export interface UpdateClaimStatusDto {
  status: ClaimStatus
  note?: string
}

/** 异常类型中文标签 */
export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  lost: '丢件',
  damage: '破损',
  delay: '延误',
  customs_fail: '清关失败',
  reject: '拒收',
  address_error: '地址错误',
}

/** 异常类型徽章配色（红=丢件/拒收，橙=破损/清关，蓝=延误/地址） */
export const CLAIM_TYPE_TAG: Record<ClaimType, 'danger' | 'warning' | 'info'> = {
  lost: 'danger',
  damage: 'warning',
  customs_fail: 'warning',
  reject: 'danger',
  delay: 'info',
  address_error: 'info',
}

/** 理赔状态中文标签 */
export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  open: '待处理',
  processing: '处理中',
  approved: '已通过',
  rejected: '已驳回',
  paid: '已赔付',
}

/** 理赔状态徽章配色（待处理=info / 处理中=warning / 通过=success / 驳回=danger / 已赔付=primary） */
export const CLAIM_STATUS_TAG: Record<ClaimStatus, 'info' | 'warning' | 'success' | 'danger' | 'primary'> = {
  open: 'info',
  processing: 'warning',
  approved: 'success',
  rejected: 'danger',
  paid: 'primary',
}

/** 责任方中文标签 */
export const CLAIM_PARTY_LABELS: Record<ClaimResponsibleParty, string> = {
  carrier: '承运商',
  platform: '平台',
  insurer: '保险',
}

/**
 * 状态流转：§20 合法后继。
 * open→processing→approved/rejected→paid；rejected/paid 为终态。
 */
export const CLAIM_NEXT_STATUS: Record<ClaimStatus, ClaimStatus[]> = {
  open: ['processing'],
  processing: ['approved', 'rejected'],
  approved: ['paid'],
  rejected: [],
  paid: [],
}

export const claimsApi = {
  /** 理赔列表：按当前租户隔离，支持状态 / 类型筛选 */
  list: (status?: string, type?: string) => {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (type) params.set('type', type)
    const qs = params.toString()
    return http.get<ClaimOut[]>(`/claims${qs ? '?' + qs : ''}`)
  },
  /** 理赔详情 */
  get: (id: string) => http.get<ClaimOut>(`/claims/${id}`),
  /** 新建理赔（运单 + 类型必填；可来自 NDR 严重异常自动建草稿，status 默认 open） */
  create: (dto: CreateClaimDto) => http.post<ClaimOut>('/claims', dto),
  /** 推进理赔状态（§20：open→processing→approved/rejected→paid） */
  updateStatus: (id: string, dto: UpdateClaimStatusDto) =>
    http.patch<ClaimOut>(`/claims/${id}/status`, dto),
}
