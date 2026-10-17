/**
 * 加价规则配置入口（任务 4.6，方案 §23 运营配置后台）。
 * 暴露 GET/POST/PUT/DELETE /pricing/markup-rules，供前端「运营配置」页读写加价规则。
 * 加价规则为平台级配置（不随租户隔离），由平台运营方（super）维护。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-17
 */

import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common'
import { ApiResponse, ok } from '../../../common/response/api-response'
import { MarkupConfigService } from './markup-config.service'
import {
  CreateMarkupConfigDto,
  MarkupConfigOut,
  UpdateMarkupConfigDto,
} from './markup-config.types'

@Controller('pricing/markup-rules')
export class MarkupConfigController {
  constructor(private readonly service: MarkupConfigService) {}

  /** 列出全部加价规则 */
  @Get()
  list(): ApiResponse<MarkupConfigOut[]> {
    return ok(this.service.list())
  }

  /** 新建加价规则 */
  @Post()
  create(@Body() dto: CreateMarkupConfigDto): ApiResponse<MarkupConfigOut> {
    return ok(this.service.create(dto))
  }

  /** 更新加价规则（部分字段） */
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMarkupConfigDto,
  ): ApiResponse<MarkupConfigOut> {
    return ok(this.service.update(id, dto))
  }

  /** 删除加价规则 */
  @Delete(':id')
  remove(@Param('id') id: string): ApiResponse<{ deleted: boolean }> {
    return ok(this.service.remove(id))
  }
}
