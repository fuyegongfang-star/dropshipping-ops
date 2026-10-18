import { Injectable, NotFoundException } from '@nestjs/common'
import {
  ClaimOut,
  ClaimStatus,
  ClaimType,
  ClaimResponsibleParty,
  CreateClaimDto,
  UpdateClaimStatusDto,
} from './claims.types'

/**
 * 理赔服务（任务 4.8，方案 §20）。
 * 管理丢件/破损/延误/清关失败/拒收/地址错误等异常理赔：承运商责任由平台代商户索赔，
 * 平台责任由平台赔付，保险件走保险。NDR 严重异常可自动建理赔草稿（见下方 seed 示例）。
 *
 * 当前为内存实现（演示口径 + 单测可跑），TODO(platform): 2026-11 接入 Prisma `Claim` 模型持久化。
 */
@Injectable()
export class ClaimsService {
  private seq = 0
  private readonly claims: ClaimOut[] = [
    {
      id: 'cl_seed_1',
      tenantId: 't_demo',
      shipmentId: 'sh_seed_1001',
      type: 'lost',
      cause: '承运商分拣丢失',
      status: 'paid',
      amount: 320.0,
      responsibleParty: 'carrier',
      refCarrierClaimId: 'DHL-CLM-7781',
      note: '承运商已赔付并冲减对账',
      createdAt: '2026-10-02T09:00:00.000Z',
      updatedAt: '2026-10-09T09:00:00.000Z',
    },
    {
      id: 'cl_seed_2',
      tenantId: 't_demo',
      shipmentId: 'sh_seed_1002',
      type: 'damage',
      cause: '运输途中挤压破损',
      status: 'approved',
      amount: 150.0,
      responsibleParty: 'carrier',
      refCarrierClaimId: null,
      note: '已审核通过，待赔付',
      createdAt: '2026-10-08T09:00:00.000Z',
      updatedAt: '2026-10-12T09:00:00.000Z',
    },
    {
      id: 'cl_seed_3',
      tenantId: 't_demo',
      shipmentId: 'sh_seed_1003',
      type: 'delay',
      cause: '清关延误导致超 SLA',
      status: 'processing',
      amount: 60.0,
      responsibleParty: 'carrier',
      refCarrierClaimId: null,
      note: '承运商核实中',
      createdAt: '2026-10-13T09:00:00.000Z',
      updatedAt: '2026-10-14T09:00:00.000Z',
    },
    {
      id: 'cl_seed_4',
      tenantId: 't_demo',
      shipmentId: 'sh_seed_1004',
      type: 'customs_fail',
      cause: '申报品类与实际不符被退运',
      status: 'open',
      amount: null,
      responsibleParty: 'platform',
      refCarrierClaimId: null,
      note: '待平台责任判定',
      createdAt: '2026-10-16T09:00:00.000Z',
      updatedAt: '2026-10-16T09:00:00.000Z',
    },
  ]

  /** 列表：按租户隔离，支持状态/类型筛选。 */
  list(tenantId: string, filter?: { status?: ClaimStatus; type?: ClaimType }): ClaimOut[] {
    return this.claims
      .filter((c) => c.tenantId === tenantId)
      .filter((c) => (filter?.status ? c.status === filter.status : true))
      .filter((c) => (filter?.type ? c.type === filter.type : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  get(tenantId: string, id: string): ClaimOut {
    const c = this.claims.find((x) => x.id === id && x.tenantId === tenantId)
    if (!c) throw new NotFoundException('理赔单不存在')
    return c
  }

  /** 新建理赔（NDR 严重异常可调用此接口自动建草稿，status 默认 open）。 */
  create(tenantId: string, dto: CreateClaimDto): ClaimOut {
    const now = new Date().toISOString()
    const claim: ClaimOut = {
      id: 'cl_' + Date.now().toString(36) + '_' + ++this.seq,
      tenantId,
      shipmentId: dto.shipmentId,
      type: dto.type,
      cause: dto.cause ?? null,
      status: 'open',
      amount: dto.amount != null ? Number(dto.amount) : null,
      responsibleParty: (dto.responsibleParty as ClaimResponsibleParty) ?? null,
      refCarrierClaimId: dto.refCarrierClaimId ?? null,
      note: null,
      createdAt: now,
      updatedAt: now,
    }
    this.claims.unshift(claim)
    return claim
  }

  /** 推进理赔状态（§20 流转：open→processing→approved/rejected→paid）。 */
  updateStatus(
    tenantId: string,
    id: string,
    dto: UpdateClaimStatusDto,
  ): ClaimOut {
    const c = this.get(tenantId, id)
    c.status = dto.status
    if (dto.note) c.note = dto.note
    c.updatedAt = new Date().toISOString()
    return c
  }
}
