/**
 * 订单状态机请求 DTO（任务 1.3，方案 §13 入口参数校验）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-10
 */

import { IsEnum, IsOptional, IsString } from 'class-validator'
import { OrderStatus, ReverseType } from './order.constants'

/** 状态转移请求体 */
export class TransitionDto {
  @IsEnum(OrderStatus)
  to!: OrderStatus // 目标状态

  @IsOptional()
  @IsString()
  operator?: string // 操作人/系统（审计，§13.1）
}

/** 逆向流程请求体 */
export class ReverseDto {
  @IsEnum(ReverseType)
  type!: ReverseType // 逆向类型（cancel/interception/redirect/return）

  @IsString()
  cause!: string // 原因（审计/排查）

  @IsOptional()
  @IsString()
  operator?: string
}
