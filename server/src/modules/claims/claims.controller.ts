import { Body, Controller, Get, Param, ParseArrayPipe, Patch, Post, Query } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ok } from '../../common/response/api-response'
import { ClaimsService } from './claims.service'
import {
  ClaimOut,
  ClaimStatus,
  ClaimType,
  CreateClaimDto,
  UpdateClaimStatusDto,
} from './claims.types'

/**
 * 理赔控制器（任务 4.8，方案 §20）。
 * 对外暴露理赔 CRUD 与状态流转；租户级隔离；NDR 严重异常可调用创建接口自动建草稿。
 */
@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  /** 理赔列表：按租户隔离，支持状态 / 类型筛选。 */
  @Get()
  list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return ok<ClaimOut[]>(
      this.claims.list(tenantId, {
        status: status as ClaimStatus | undefined,
        type: type as ClaimType | undefined,
      }),
    )
  }

  /** 理赔详情。 */
  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id') id: string) {
    return ok<ClaimOut>(this.claims.get(tenantId, id))
  }

  /** 新建理赔（运单 + 类型必填；可来自 NDR 严重异常自动建草稿）。 */
  @Post()
  create(@TenantId() tenantId: string, @Body() dto: CreateClaimDto) {
    return ok<ClaimOut>(this.claims.create(tenantId, dto))
  }

  /** 推进理赔状态（§20：open→processing→approved/rejected→paid）。 */
  @Patch(':id/status')
  updateStatus(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateClaimStatusDto,
  ) {
    return ok<ClaimOut>(this.claims.updateStatus(tenantId, id, dto))
  }
}
