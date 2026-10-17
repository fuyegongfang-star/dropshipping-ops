/**
 * 加价规则配置 DTO（任务 4.6，方案 §10.2 / §23 运营配置后台）。
 * 运营侧在「运营配置」页维护的加价规则。与比价引擎的运行期规则（MarkupRulesService）解耦存储：
 * 本结构是「配置数据入口」，二期将把此处配置同步进引擎解析链路（TODO(dev): 2026-11 接通）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-17
 */
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator'

/** 加价作用域：全局 / 租户 / 承运商 / 渠道 / 品类 */
export type MarkupConfigScope = 'global' | 'tenant' | 'carrier' | 'channel' | 'product'
/** 加价方式：按比例（%）或固定金额（基准币种） */
export type MarkupConfigMode = 'percent' | 'fixed'

/** 加价规则对外输出（与前端 web/src/api/pricing.ts 的 MarkupRule 对齐） */
export interface MarkupConfigOut {
  id: string
  scope: MarkupConfigScope
  /** 作用域目标：全局=全部渠道 / 其余为具体对象名（承运商/租户/渠道/品类） */
  target: string
  mode: MarkupConfigMode
  /** 加价幅度：percent 为百分比数值，fixed 为基准币种金额 */
  value: number
  /** 优先级（数字大者优先，同作用域冲突时胜出） */
  priority: number
  enabled: boolean
  note: string
}

/** 新建加价规则入参 */
export class CreateMarkupConfigDto {
  @IsIn(['global', 'tenant', 'carrier', 'channel', 'product'])
  scope!: MarkupConfigScope

  @IsString()
  target!: string

  @IsIn(['percent', 'fixed'])
  mode!: MarkupConfigMode

  @IsNumber()
  value!: number

  @IsNumber()
  priority!: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  note?: string
}

/** 更新加价规则入参（全字段可选，部分更新） */
export class UpdateMarkupConfigDto {
  @IsOptional()
  @IsIn(['global', 'tenant', 'carrier', 'channel', 'product'])
  scope?: MarkupConfigScope

  @IsOptional()
  @IsString()
  target?: string

  @IsOptional()
  @IsIn(['percent', 'fixed'])
  mode?: MarkupConfigMode

  @IsOptional()
  @IsNumber()
  value?: number

  @IsOptional()
  @IsNumber()
  priority?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  note?: string
}
