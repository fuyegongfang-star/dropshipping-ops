/**
 * 地址校验与标准化服务（任务 3.12，方案 §18 地址校验与标准化）。
 *
 * 职责（§18）：
 *  - 脏地址检测：必填字段缺失、邮编格式不符目的国规范、电话格式可疑；
 *  - 地址标准化：统一大小写 / 去冗余空格 / 邮编大写；
 *  - 质量分：字段完整度(70%) + 格式合规(30%)，低分提示/拦截；
 *  - 分区与可行性：经 ZoneMapService 解析邮编→分区/远程/可达，并给出各承运商可行性（§4.4 驱动）。
 *
 * 校验时机（§18）：试算（§4）输入即校验、下单强校验；本服务只产出分级 issue，由上层决定拦截或转人工。
 *
 * 说明：邮编格式库 / 远程区 / 分区为合理占位（TODO 2026-11 联调校正，对齐各国本地邮编库 + 承运商远程区表）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

import { Injectable } from '@nestjs/common'
import { CarrierCode } from '../carrier.constants'
import { ZoneMapService } from './zone-map.service'
import {
  AddressSpec,
  AddressIssue,
  AddressValidateRequest,
  AddressValidationResult,
  CarrierFeasibility,
  ZoneInfo,
} from './address.types'

/** 承运商展示名（演示用，真实名取自 Carrier 目录；缺失时回退 code） */
const CARRIER_NAMES: Record<string, string> = {
  [CarrierCode.YUNEXPRESS]: '云途',
  [CarrierCode.DHL]: 'DHL Express',
  [CarrierCode.FOURPX]: '递四方',
  [CarrierCode.YANWEN]: '燕文',
  [CarrierCode.MOCK]: '演示承运商',
}

/** 参与可行性评估的全部承运商（演示全集；真实接入后由 Carrier 目录动态取） */
const ALL_CARRIERS = Object.values(CarrierCode)

/** 校验必需的字段（质量分完整度以此为基准） */
const REQUIRED_FIELDS: (keyof AddressSpec)[] = [
  'country',
  'postalCode',
  'city',
  'addressLine1',
  'name',
  'phone',
]

@Injectable()
export class AddressService {
  constructor(private readonly zone: ZoneMapService) {}

  /** 地址校验主入口：标准化 → 质量分 → 问题 → 分区 → 多承运商可行性 */
  validate(req: AddressValidateRequest): AddressValidationResult {
    const issues: AddressIssue[] = []
    const country = (req.country || '').toUpperCase()
    const postalRaw = (req.postalCode || '').trim()

    // 1) 必填字段
    if (!country) {
      issues.push({ level: 'error', code: 'COUNTRY_MISSING', message: '目的国必填（ISO2，如 US/DE/GB）', field: 'country' })
    }
    if (!postalRaw) {
      issues.push({ level: 'error', code: 'POSTAL_MISSING', message: '邮政编码必填', field: 'postalCode' })
    }
    if (!req.city) issues.push({ level: 'warning', code: 'CITY_MISSING', message: '建议补充城市（提升投递准确率）', field: 'city' })
    if (!req.addressLine1) issues.push({ level: 'warning', code: 'ADDRESS1_MISSING', message: '建议补充街道门牌（地址行 1）', field: 'addressLine1' })
    if (!req.name) issues.push({ level: 'warning', code: 'NAME_MISSING', message: '建议补充收件人姓名', field: 'name' })
    if (!req.phone) issues.push({ level: 'warning', code: 'PHONE_MISSING', message: '建议补充联系电话（便于派送联系）', field: 'phone' })

    // 2) 邮编格式（按目的国规范）
    const postalFormatOk = country ? this.zone.isPostalFormatValid(country, postalRaw) : false
    if (country && postalRaw && !postalFormatOk) {
      issues.push({
        level: 'error',
        code: 'POSTAL_FORMAT',
        message: `邮编格式不符合 ${country} 规范（如美国 5 位、德国 5 位、英国字母数字混合）`,
        field: 'postalCode',
      })
    }

    // 3) 电话简易国际格式（可含 + 区号、空格、短横线）
    let phoneFormatOk = true
    if (req.phone && !/^\+?[\d\s-]{6,20}$/.test(req.phone.trim())) {
      phoneFormatOk = false
      issues.push({ level: 'warning', code: 'PHONE_FORMAT', message: '电话格式可疑，建议含国际区号（如 +1 415...）', field: 'phone' })
    }

    // 4) 标准化：去冗余空格、邮编大写、国家大写
    const normalized: AddressSpec = {
      country,
      name: req.name?.trim() || undefined,
      phone: req.phone?.trim() || undefined,
      state: req.state?.trim() || undefined,
      city: req.city?.trim() || undefined,
      addressLine1: req.addressLine1?.trim() || undefined,
      addressLine2: req.addressLine2?.trim() || undefined,
      postalCode: postalRaw.toUpperCase(),
    }

    // 5) 质量分：完整度 70% + 格式合规 30%
    const filled = REQUIRED_FIELDS.filter((f) => (req[f] as unknown as string)?.toString().trim()).length
    const completeness = filled / REQUIRED_FIELDS.length
    const formatOk = postalFormatOk && phoneFormatOk
    const qualityScore = Math.round(completeness * 70 + (formatOk ? 30 : 0))

    // 6) 分区 + 多承运商可行性：未指定承运商则对全集评估
    const carrierCodes = req.carriers && req.carriers.length ? req.carriers : ALL_CARRIERS
    const feasibility: CarrierFeasibility[] = carrierCodes.map((code) => {
      const hit = this.zone.resolve(code, country, normalized.postalCode)
      return {
        carrierCode: code,
        carrierName: CARRIER_NAMES[code] ?? code,
        zoneCode: hit.zoneCode,
        region: hit.region,
        isRemote: hit.isRemote,
        reachable: country ? hit.reachable : false,
        note: !country
          ? '目的国缺失，暂无法评估'
          : hit.reachable
            ? hit.isRemote
              ? '偏远区，将加收远程附加费（§4.4）'
              : '可达，费率正常'
            : '该承运商此分区不可达，建议转其他承运商 / 聚合兜底（§3e）',
      }
    })

    const primary = feasibility[0]
    const zone: ZoneInfo = {
      country,
      postalCode: normalized.postalCode ?? '',
      zoneCode: primary?.zoneCode ?? 'ZONE_1',
      region: primary?.region ?? `${country}·其他区域`,
      isRemote: primary?.isRemote ?? false,
      reachable: primary?.reachable ?? false,
    }

    const valid = !issues.some((i) => i.level === 'error')
    return { valid, normalized, qualityScore, issues, zone, feasibility }
  }
}
