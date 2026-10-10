/**
 * 拉单请求体 DTO（方案 §3 拉单，入口参数校验）。
 * 对应 ChannelPullOptions：增量拉取起点 / 平台游标 / 单页上限。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class ChannelPullOptionsDto {
  @IsOptional()
  @IsString()
  since?: string // 增量拉取起点（UTC ISO）

  @IsOptional()
  @IsString()
  cursor?: string // 平台游标（分页）

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number // 单页上限（≥1）
}
