import { Module } from '@nestjs/common'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'

/**
 * 运营报表模块（任务 4.7，方案 §25）。
 * 聚合履约/物流时效、利润、渠道分布、异常率看板指标；无外部依赖，纯内存代表值。
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
