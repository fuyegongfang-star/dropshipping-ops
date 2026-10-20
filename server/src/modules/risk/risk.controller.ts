import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { TenantId } from '../../common/tenant/tenant.decorator'
import { ok } from '../../common/response/api-response'
import { RiskService } from './risk.service'
import {
  BlacklistEntry,
  CreateBlacklistDto,
  CreateRiskRuleDto,
  ReviewDecisionDto,
  RiskOrderEvaluation,
  RiskRule,
  RiskSummary,
  UpdateRiskRuleDto,
} from './risk.types'

/**
 * 风控控制器（任务 5.1，方案 §26 风控体系）。
 * 对外暴露：风控总览、规则引擎 CRUD、黑名单 CRUD、风险订单评分列表/详情、人工审核。
 * 全部按租户隔离；高风险转人工审核（结合 §13 待审）。
 *
 * 返回类型交由 ok<T>() 推断为 ApiResponse<T>（与 Claim/Finance 等模块一致，§31 统一响应）。
 */
@Controller('risk')
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  /** 风控总览（页面四卡）。 */
  @Get('summary')
  summary(@TenantId() tenantId: string) {
    return ok<RiskSummary>(this.risk.summary(tenantId))
  }

  /** 风险订单评分列表（按租户隔离）。 */
  @Get('orders')
  listOrders(@TenantId() tenantId: string) {
    return ok<RiskOrderEvaluation[]>(this.risk.listOrders(tenantId))
  }

  /** 风险订单详情（评分明细）。 */
  @Get('orders/:id')
  getOrder(@TenantId() tenantId: string, @Param('id') id: string) {
    return ok<RiskOrderEvaluation>(this.risk.getOrder(tenantId, id))
  }

  /** 人工审核决策（§26 高风险转人工，结合 §13 待审）。 */
  @Post('orders/:id/review')
  reviewOrder(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return ok<RiskOrderEvaluation>(this.risk.reviewOrder(tenantId, id, dto))
  }

  /** 规则引擎列表（按租户隔离）。 */
  @Get('rules')
  listRules(@TenantId() tenantId: string) {
    return ok<RiskRule[]>(this.risk.listRules(tenantId))
  }

  /** 新建规则（名称/类别必填）。 */
  @Post('rules')
  createRule(@TenantId() tenantId: string, @Body() dto: CreateRiskRuleDto) {
    return ok<RiskRule>(this.risk.createRule(tenantId, dto))
  }

  /** 更新规则（常用于启停开关）。 */
  @Patch('rules/:id')
  updateRule(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRiskRuleDto,
  ) {
    return ok<RiskRule>(this.risk.updateRule(tenantId, id, dto))
  }

  /** 删除规则。 */
  @Delete('rules/:id')
  deleteRule(@TenantId() tenantId: string, @Param('id') id: string) {
    return ok<{ deleted: boolean }>(this.risk.deleteRule(tenantId, id))
  }

  /** 黑名单列表（按租户隔离）。 */
  @Get('blacklist')
  listBlacklist(@TenantId() tenantId: string) {
    return ok<BlacklistEntry[]>(this.risk.listBlacklist(tenantId))
  }

  /** 新增黑名单（类型/值必填）。 */
  @Post('blacklist')
  addBlacklist(@TenantId() tenantId: string, @Body() dto: CreateBlacklistDto) {
    return ok<BlacklistEntry>(this.risk.addBlacklist(tenantId, dto))
  }

  /** 移除黑名单。 */
  @Delete('blacklist/:id')
  removeBlacklist(@TenantId() tenantId: string, @Param('id') id: string) {
    return ok<{ deleted: boolean }>(this.risk.removeBlacklist(tenantId, id))
  }
}
