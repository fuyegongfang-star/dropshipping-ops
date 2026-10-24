/**
 * 新增店铺（渠道绑定）请求体 DTO（任务 6.1，方案 §3 渠道接入）。
 * 对应 Prisma `Shop`：tenantId 由租户上下文注入，platform/name 必填，authConfig 可选。
 *
 * 负责人：自动开发引擎 ｜ 创建：2026-10-24
 */

import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import { ChannelPlatform } from '../channel.constants'

export class CreateShopDto {
  /** 渠道平台代码（对齐 Shop.platform）：shopify/amazon/taobao/douyin/mock/independent/tiktok */
  @IsString()
  @IsIn(Object.values(ChannelPlatform))
  platform: string

  /** 店铺展示名（≤60 字） */
  @IsString()
  @MaxLength(60)
  name: string

  /** 平台授权信息（加密存储，§17）；演示态传 null 即可 */
  @IsOptional()
  @IsObject()
  authConfig?: Record<string, unknown> | null
}
