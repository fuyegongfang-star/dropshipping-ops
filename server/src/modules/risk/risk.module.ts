import { Module } from '@nestjs/common'
import { RiskService } from './risk.service'
import { RiskController } from './risk.controller'

/**
 * 风控模块（任务 5.1，方案 §26 风控体系）。
 * 规则引擎 + 评分 + 黑名单 + 人工审核；全部按租户隔离。
 */
@Module({
  controllers: [RiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
