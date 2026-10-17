import { Controller, Get } from '@nestjs/common'
import { ok } from '../../common/response/api-response'
import { ReportsService } from './reports.service'
import { ReportDashboard } from './reports.types'

/**
 * 运营报表控制器（任务 4.7，方案 §25）。
 * 对外暴露聚合看板指标，前端「运营报表」页单请求拉取全部指标。
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** 运营报表总览：履约/物流时效、利润、渠道分布、异常率。 */
  @Get('overview')
  overview() {
    return ok<ReportDashboard>(this.reports.getDashboard())
  }
}
