/**
 * 地址校验与分区规格（任务 3.12，方案 §18 地址校验与标准化）。
 *
 * 职责：在试算（§4）输入即校验、下单强校验（§18 校验时机）；地址质量分低 → 提示/拦截。
 * 分区引擎 `zone_maps`（邮编→分区/远程标记，按承运商）驱动远程附加费与可达性（§4.4）。
 *
 * 说明：邮编格式库、远程区表与分区为合理占位（TODO 2026-11 联调校正，对齐 DHL/UPS 远程区表 + 各国本地邮编库）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

/** 地址校验入参（一段运单的收件人地址，含目的国与邮编） */
export interface AddressSpec {
  country: string // 目的国（ISO2，如 US/DE/GB）
  name?: string // 收件人姓名
  phone?: string // 联系电话（含国际区号）
  state?: string // 州 / 省
  city?: string // 城市
  addressLine1?: string // 地址行 1（街道门牌）
  addressLine2?: string // 地址行 2（单元 / 公司，可选）
  postalCode?: string // 邮政编码（按目的国格式校验）
}

/** 地址校验请求：地址本体 + 需要评估可行性的承运商列表 */
export interface AddressValidateRequest extends AddressSpec {
  carriers?: string[] // 需评估分区/可达性的承运商代码（省略则仅做通用分区）
}

/** 地址问题（error 阻断 / warning 提示 / info 建议） */
export interface AddressIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
  field?: string // 关联字段（country/postalCode/phone…），便于前端高亮
}

/** 分区信息（邮编→zone，§18 zone_maps；分区驱动远程费与可达性，§4.4） */
export interface ZoneInfo {
  country: string // 目的国（ISO2）
  postalCode: string // 原样回显（已归一化大写）
  zoneCode: string // 分区代码（如 ZONE_1..ZONE_5）
  region: string // 区域中文名（如 北美·本土 / 欧洲·西欧）
  isRemote: boolean // 是否偏远地区（触发远程附加费 §4.4）
  reachable: boolean // 该承运商是否可达（不可达 → 转其他承运商/聚合兜底 §3e）
}

/** 单个承运商的可行性结论（分区 + 远程 + 可达，按承运商覆盖 §18 zone_maps） */
export interface CarrierFeasibility {
  carrierCode: string
  carrierName: string
  zoneCode: string
  region: string
  isRemote: boolean
  reachable: boolean
  note: string
}

/** 地址校验结果（§18 标准化 + 质量分 + 分区 + 承运商可行性） */
export interface AddressValidationResult {
  valid: boolean // 是否通过（无 error 即通过，可下单）
  normalized: AddressSpec // 标准化后的地址（统一大小写/去冗余空格/国家名补全）
  qualityScore: number // 地址质量分 0-100（字段完整度 70% + 格式合规 30%）
  issues: AddressIssue[]
  zone: ZoneInfo // 目的地址分区结论（通用 / 默认承运商维度）
  feasibility: CarrierFeasibility[] // 各承运商可行性（批量试算时用）
}
