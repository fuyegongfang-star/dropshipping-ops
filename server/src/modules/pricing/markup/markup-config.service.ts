/**
 * 加价规则配置服务（任务 4.6，方案 §23 运营配置后台）。
 * 内存态存储运营维护的加价规则（待 §10.6 落 markup_rules 表）。
 * 与比价引擎的 MarkupRulesService（运行期生效规则）解耦：本服务是「配置数据入口」，
 * 二期将把此处配置同步进引擎解析链路（TODO(dev): 2026-11 接通引擎）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-17
 */

import { Injectable, NotFoundException } from '@nestjs/common'
import { AppLogger } from '../../../common/logger/app.logger'
import { BusinessException } from '../../../common/response/business.exception'
import {
  CreateMarkupConfigDto,
  MarkupConfigOut,
  UpdateMarkupConfigDto,
} from './markup-config.types'

@Injectable()
export class MarkupConfigService {
  /** 内存规则表（待 §10.6 持久化 markup_rules） */
  private readonly rules: MarkupConfigOut[] = []
  /** 自增序号，保证新建 id 唯一 */
  private seq = 0

  constructor(private readonly logger: AppLogger) {
    this.seedDefaults()
  }

  /** 默认加价规则（与演示端 mock-data 种子对齐，保证正式/演示两端初始一致）。 */
  private seedDefaults(): void {
    this.rules.push(
      { id: 'mk_global', scope: 'global', target: '全部渠道', mode: 'percent', value: 12, priority: 100, enabled: true, note: '基础加价；未命中专属规则时生效' },
      { id: 'mk_tenant_acme', scope: 'tenant', target: 'Acme 跨境店', mode: 'percent', value: 5, priority: 80, enabled: true, note: '大客户专属低加价' },
      { id: 'mk_carrier_dhl', scope: 'carrier', target: 'DHL 快递', mode: 'percent', value: 8, priority: 60, enabled: true, note: '商业快递官方价高，加价率下调' },
      { id: 'mk_carrier_yun', scope: 'carrier', target: '云途物流', mode: 'percent', value: 15, priority: 60, enabled: true, note: '专线小包走量，略高加价' },
      { id: 'mk_product_battery', scope: 'product', target: '带电类目', mode: 'percent', value: 6, priority: 40, enabled: true, note: '带电附加成本转嫁' },
      { id: 'mk_channel_amz', scope: 'channel', target: 'Amazon US', mode: 'fixed', value: 2, priority: 50, enabled: false, note: '固定加价，已停用' },
    )
  }

  /** 列出全部加价规则（返回副本，避免调用方直接改写内存态）。 */
  list(): MarkupConfigOut[] {
    return this.rules.map((r) => ({ ...r }))
  }

  /** 新建加价规则；目标为空或加价幅度为负时拒绝（诚实失败，避免脏数据）。 */
  create(dto: CreateMarkupConfigDto): MarkupConfigOut {
    const target = String(dto.target ?? '').trim()
    if (!target) {
      throw new BusinessException('MARKUP_TARGET_EMPTY', '加价规则目标不能为空', 400)
    }
    const value = Number(dto.value)
    const rule: MarkupConfigOut = {
      id: `mk_${++this.seq}_${Date.now().toString(36)}`,
      scope: dto.scope,
      target,
      mode: dto.mode,
      value: Number.isFinite(value) && value >= 0 ? value : 0,
      priority: Number.isFinite(Number(dto.priority)) ? Number(dto.priority) : 50,
      enabled: dto.enabled ?? true,
      note: dto.note ?? '',
    }
    this.rules.push(rule)
    this.logger.log(`创建加价规则 ${rule.id}（${rule.target}）`)
    return { ...rule }
  }

  /** 更新加价规则（部分更新，仅覆盖传入字段）。 */
  update(id: string, dto: UpdateMarkupConfigDto): MarkupConfigOut {
    const idx = this.rules.findIndex((r) => r.id === id)
    if (idx < 0) throw new NotFoundException(`加价规则不存在：${id}`)
    const cur = this.rules[idx]
    const next: MarkupConfigOut = {
      id,
      scope: dto.scope ?? cur.scope,
      target: dto.target !== undefined ? String(dto.target).trim() : cur.target,
      mode: dto.mode ?? cur.mode,
      value: dto.value !== undefined ? (Number(dto.value) >= 0 ? Number(dto.value) : cur.value) : cur.value,
      priority: dto.priority !== undefined && Number.isFinite(Number(dto.priority)) ? Number(dto.priority) : cur.priority,
      enabled: dto.enabled !== undefined ? Boolean(dto.enabled) : cur.enabled,
      note: dto.note !== undefined ? String(dto.note) : cur.note,
    }
    this.rules[idx] = next
    return { ...next }
  }

  /** 删除加价规则。 */
  remove(id: string): { deleted: boolean } {
    const idx = this.rules.findIndex((r) => r.id === id)
    if (idx < 0) throw new NotFoundException(`加价规则不存在：${id}`)
    this.rules.splice(idx, 1)
    return { deleted: true }
  }
}
