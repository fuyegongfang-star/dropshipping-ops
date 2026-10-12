/**
 * 可达性服务（任务 3.5，方案 §5 L2 可达性地图 serviceability）。
 * 承运商 × 国家/邮编/货物类型查表，<5ms 剔除不可达，减少无效实时调用（§5）。
 * 当前为内存规则表（最佳适配）；待 §18 地址标准化 + zone_maps 接入后补齐分区与偏远判定。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-12
 */

import { Injectable } from '@nestjs/common'
import { CarrierCode } from '../carriers/carrier.constants'
import { CargoType } from '../carriers/dto/rate.dto'

/** 单条可达性判定结果 */
export interface ReachabilityResult {
  reachable: boolean // 是否可达
  reason?: string // 不可达原因（便于排障与前端提示）
}

/**
 * 可达性规则：基础版按「承运商 × 货物类型 × 目的国」做白/黑名单。
 * 规则集中管理，便于后续接 DB / zone_maps（§18）。
 */
@Injectable()
export class ReachabilityService {
  /**
   * 判定可达性。
   * @param code 承运商代码
   * @param destCountry 目的国（ISO2）
   * @param cargoType 货物类型（默认 general）
   */
  isReachable(code: CarrierCode, destCountry: string, cargoType?: CargoType): ReachabilityResult {
    const country = (destCountry || '').toUpperCase()
    const cargo = cargoType ?? CargoType.GENERAL

    // 1) 禁运国家（演示口径，待 §18 接入真实 zone_maps 校正）
    const blockedCountries = new Set<string>(['KP', 'IR', 'SY']) // 朝鲜/伊朗/叙利亚 示例禁运
    if (blockedCountries.has(country)) {
      return { reachable: false, reason: `目的国 ${country} 当前不可达（禁运）` }
    }

    // 2) 货物类型 × 承运商限制（演示口径，待运营配置化，§18/§19）
    const sensitiveCargo: CargoType[] = [CargoType.BATTERY, CargoType.LIQUID, CargoType.POWDER, CargoType.SENSITIVE]
    if (sensitiveCargo.includes(cargo) && code === CarrierCode.YANWEN) {
      return { reachable: false, reason: '燕文不支持敏感货（电池/液体/粉末/敏感）' }
    }

    return { reachable: true }
  }
}
