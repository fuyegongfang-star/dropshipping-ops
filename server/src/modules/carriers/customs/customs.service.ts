/**
 * 报关/合规校验服务（任务 3.10，方案 §19 申报/合规自动化）。
 *
 * 职责：在 booking（建单）前对一段运单的报关要素做合规关卡校验（§19 守卫）：
 *  - HS 编码格式与缺失提示；
 *  - 申报价值必填与合理性；
 *  - 欧盟 IOSS(≤150€)/EORI、英国 EORI 的按目的国规则格式校验；
 *  - 美国 Section 321（≤$800 T86）低值免税资格判定；
 *  - 敏感货物（带电/液体）禁运风险提示。
 * 任一 error 级问题即 `valid=false`，阻断或转人工（由上层建单编排决定）。
 *
 * 说明：阈值与格式为合理占位（TODO 2026-11 联调校正，对齐各国海关规则表 compliance_rules）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-13
 */

import { Injectable } from '@nestjs/common'
import { CustomsSpec, CustomsIssue, CustomsValidationResult } from './customs.types'

/** 欧盟成员国（需 IOSS 或 EORI） */
const EU_COUNTRIES = new Set(['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'PL', 'SE', 'AT', 'IE', 'PT'])
const SECTION321_LIMIT_USD = 800

@Injectable()
export class CustomsService {
  validate(spec: CustomsSpec): CustomsValidationResult {
    const issues: CustomsIssue[] = []
    const dest = (spec.destCountry || '').toUpperCase()
    const value = spec.declaredValue ?? NaN
    const isEu = EU_COUNTRIES.has(dest)
    const isGb = dest === 'GB'
    const isUs = dest === 'US'

    // 1) 申报价值：必填且为正
    if (!Number.isFinite(value) || value <= 0) {
      issues.push({ level: 'error', code: 'DECLARED_VALUE_MISSING', message: '申报价值必填且必须大于 0' })
    }

    // 2) HS 编码：缺失提示；存在则校验 6-12 位数字
    if (!spec.hsCode) {
      issues.push({ level: 'warning', code: 'HS_MISSING', message: '建议填写 HS 编码以便快速清关（商品库可维护 SKU→HS 映射）' })
    } else if (!/^\d{6,12}$/.test(spec.hsCode)) {
      issues.push({ level: 'error', code: 'HS_FORMAT', message: 'HS 编码应为 6-12 位数字' })
    }

    // 3) 欧盟：需 IOSS(≤150€) 或 EORI
    if (isEu) {
      if (!spec.ioss && !spec.eori) {
        issues.push({ level: 'error', code: 'EU_TAX_ID_MISSING', message: '欧盟进口需提供 IOSS 或 EORI' })
      } else {
        if (spec.ioss && !/^IM\d{10}$/.test(spec.ioss)) {
          issues.push({ level: 'warning', code: 'IOSS_FORMAT', message: 'IOSS 格式应为 IM + 10 位数字' })
        }
        if (spec.eori && !/^[A-Z]{2}[A-Za-z0-9]+$/.test(spec.eori)) {
          issues.push({ level: 'warning', code: 'EORI_FORMAT', message: 'EORI 格式应为 2 位国别 + 字母数字' })
        }
      }
    }

    // 4) 英国：需 EORI
    if (isGb && !spec.eori) {
      issues.push({ level: 'error', code: 'GB_EORI_MISSING', message: '英国进口需提供 EORI' })
    }

    // 5) 美国 Section 321（≤$800 T86 低值免税）
    let eligibleSection321 = false
    let recommendedDuty: CustomsValidationResult['recommendedDuty'] = 'UNKNOWN'
    if (isUs) {
      const within = Number.isFinite(value) && value <= SECTION321_LIMIT_USD
      eligibleSection321 = within
      if (spec.section321 && !within) {
        issues.push({
          level: 'error',
          code: 'SECTION321_OVER_LIMIT',
          message: `Section 321 仅适用 ≤ $${SECTION321_LIMIT_USD}，当前申报 $${value} 超限，需走正式申报`,
        })
      } else if (within) {
        issues.push({ level: 'info', code: 'SECTION321_OK', message: `符合 Section 321（≤$${SECTION321_LIMIT_USD}）T86 免税申报` })
        recommendedDuty = 'T86'
      } else {
        issues.push({ level: 'info', code: 'FORMAL_ENTRY', message: '申报价值 > $800，建议走正式申报（T01）' })
        recommendedDuty = 'T01'
      }
    } else if (isEu) {
      recommendedDuty = spec.ioss ? 'DDP' : 'UNKNOWN'
    }

    // 6) 敏感货物（带电/液体）禁运风险提示
    if (spec.cargoType === 'battery' || spec.cargoType === 'liquid' || spec.cargoType === 'sensitive') {
      issues.push({
        level: 'warning',
        code: 'SENSITIVE_CARGO',
        message: '敏感货物（带电/液体/敏感货）部分渠道禁运，需确认承运商可达性（§4.3）',
      })
    }

    const valid = !issues.some((i) => i.level === 'error')
    return { valid, issues, eligibleSection321, recommendedDuty }
  }
}
