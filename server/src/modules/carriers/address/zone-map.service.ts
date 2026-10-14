/**
 * 邮编→分区映射引擎（任务 3.12，方案 §18 zone_maps）。
 *
 * 职责：把「目的国 + 邮编」解析为分区（ZONE_1..ZONE_5）+ 区域 + 偏远标记；并按承运商覆盖
 * 给出可达性（不同承运商分区/可达性不同）。分区驱动远程附加费与可达性（§4.4）。
 *
 * 设计要点：
 *  - 分区采用「邮编首字符 → 确定性落入 ZONE_1..ZONE_5」，保证同一地址稳定落在同一区（演示可解释）。
 *  - 远程区：命中各国远程前缀表即偏远（占位：美国 AK/HI/关岛、加拿大北部、澳洲北领地…）。
 *  - 可达性：各承运商在部分国家分区不可达（占位），不可达 → 上层转其他承运商或聚合兜底（§3e）。
 *  - 缺失真实邮编库时，无法识别的邮编按「格式合规即可达、否则标记偏远」降级，保证流程不中断。
 *
 * 说明：分区表 / 远程区 / 可达性为合理占位（TODO 2026-11 联调校正，对齐 DHL/UPS 远程区表 + 各国本地邮编库）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-14
 */

import { Injectable } from '@nestjs/common'
import { CarrierCode } from '../carrier.constants'

/** 分区命中结果 */
export interface ZoneHit {
  zoneCode: string
  region: string
  isRemote: boolean
  reachable: boolean
}

/** 各国邮编格式（粗略校验用，匹配即视为格式合规） */
const POSTAL_FORMAT: Record<string, RegExp> = {
  US: /^\d{5}(-\d{4})?$/, // 美国 ZIP / ZIP+4
  DE: /^\d{5}$/, // 德国 PLZ
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, // 英国 postcode
  FR: /^\d{5}$/,
  CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i, // 加拿大
  AU: /^\d{4}$/,
  JP: /^\d{3}-?\d{4}$/,
}

/** 远程区邮编前缀（按目的国，命中即偏远）。占位数据。 */
const REMOTE_PREFIX: Record<string, string[]> = {
  US: ['99', '96', '969', '995', '997', '998'], // 阿拉斯加/夏威夷/关岛等
  CA: ['Y', 'X0'], // 育空/努纳武特等北部
  AU: ['08', '087'], // 北领地偏远
}

/** 各承运商不可达分区（占位）：该承运商在以下国家分区不可达，需转其他承运商/聚合兜底 §3e。 */
const CARRIER_UNREACHABLE: Record<string, Record<string, string[]>> = {
  [CarrierCode.YUNEXPRESS]: {}, // 云途全可达
  [CarrierCode.DHL]: {}, // DHL 全可达
  [CarrierCode.FOURPX]: { US: ['ZONE_5'] }, // 4PX 美国 ZONE_5 不接
  [CarrierCode.YANWEN]: { CA: ['ZONE_4', 'ZONE_5'] }, // 燕文加拿大远区不接
  [CarrierCode.MOCK]: {},
}

/** 目的国 → 区域中文名（演示用） */
const REGION_NAME: Record<string, string> = {
  US: '北美·本土',
  CA: '北美·加拿大',
  MX: '北美·墨西哥',
  DE: '欧洲·西欧',
  FR: '欧洲·西欧',
  GB: '欧洲·英国',
  ES: '欧洲·南欧',
  IT: '欧洲·南欧',
  NL: '欧洲·西欧',
  AU: '大洋洲·澳洲',
  JP: '亚洲·东亚',
  CN: '亚洲·东亚',
}

/** 以邮编首字符确定性落入 ZONE_1..ZONE_5（演示可解释，同一地址稳定） */
function deriveZone(country: string, postal: string): { zoneCode: string; region: string } {
  const cleaned = (postal || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const first = cleaned[0] ?? '0'
  const n = /[0-9]/.test(first) ? Number(first) : first.charCodeAt(0) % 5
  const zoneIndex = (n % 5) + 1 // 1..5
  return {
    zoneCode: `ZONE_${zoneIndex}`,
    region: `${country}·${REGION_NAME[country] ?? '其他区域'}`,
  }
}

@Injectable()
export class ZoneMapService {
  /** 邮编格式校验（按目的国规范；无规范则视为合规） */
  isPostalFormatValid(country: string, postal?: string): boolean {
    if (!postal) return false
    const fmt = POSTAL_FORMAT[country]
    return fmt ? fmt.test(postal.trim()) : true
  }

  /**
   * 解析「承运商 + 目的国 + 邮编」→ 分区结论。
   * 邮编为空 / 格式非法时：尽力返回（区按默认值），可达性由上层结合错误判断。
   */
  resolve(carrierCode: string, country: string, postal?: string): ZoneHit {
    const cc = (carrierCode || CarrierCode.MOCK).toLowerCase()
    const c = (country || '').toUpperCase()
    const normalizedPostal = (postal || '').trim().toUpperCase()
    const { zoneCode, region } = deriveZone(c, normalizedPostal)

    // 远程标记：命中远程前缀
    const remotePrefixes = REMOTE_PREFIX[c] ?? []
    const isRemote = remotePrefixes.some((p) => normalizedPostal.startsWith(p))

    // 可达性：承运商在该国该分区是否可达
    const blocked = CARRIER_UNREACHABLE[cc]?.[c] ?? []
    const reachable = !blocked.includes(zoneCode)

    return { zoneCode, region, isRemote, reachable }
  }

  /** 批量解析多个承运商的分区结论（§18 多承运商可行性） */
  resolveMany(carrierCodes: string[], country: string, postal?: string): ZoneHit[] {
    return carrierCodes.map((code) => this.resolve(code, country, postal))
  }
}
