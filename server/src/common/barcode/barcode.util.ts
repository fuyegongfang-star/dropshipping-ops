/**
 * 条码校验位工具（任务 7.1，阶段7 详细设计）。
 *
 * 供应商贴的码经常校验位对不上（乱贴 / 手工录入笔误），按方案约定：
 * 校验位不符**仅提示、不拦截**录入，避免卡住现场作业。
 * 因此这里只做"算出期望校验位并比对"，返回是否合法，由调用方决定提示文案。
 *
 * 支持：
 *  - EAN-13：13 位，奇数位×1 + 偶数位×3，校验位使总和 ≡ 0 (mod 10)。
 *  - UPC-A ：12 位，奇数位×3 + 偶数位×1，校验位使总和 ≡ 0 (mod 10)。
 * 两种标准权重相反，按长度自动识别。
 */

export type BarcodeStandard = 'EAN-13' | 'UPC-A'

export interface BarcodeCheckResult {
  /** 是否命中标准长度（否则不入校验逻辑，返回 valid=true 表示"无需校验"） */
  matched: boolean
  /** 命中标准时，校验位是否一致 */
  valid: boolean
  /** 命中的码制 */
  standard?: BarcodeStandard
  /** 期望的校验位数字（用于回显"应为 X"） */
  expectedCheckDigit?: string
}

/**
 * 计算 EAN-13 / UPC-A 的期望校验位。
 * @param body 不含校验位的主体数字串（EAN-13 取前 12 位，UPC-A 取前 11 位）
 * @param weights 从第一位开始的权重序列（EAN 为 [1,3,...]，UPC 为 [3,1,...]）
 */
function computeCheckDigit(body: string, weights: number[]): string {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    sum += Number(body[i]) * (weights[i] ?? 1)
  }
  return String((10 - (sum % 10)) % 10)
}

/** 比对条码校验位：命中标准且一致才 valid=true；非标准长度返回 matched=false（放行录入）。 */
export function checkBarcodeDigit(code: string): BarcodeCheckResult {
  const digits = code.replace(/\D/g, '')
  if (digits.length === 13) {
    const body = digits.slice(0, 12)
    const expected = computeCheckDigit(body, [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3])
    return {
      matched: true,
      valid: expected === digits[12],
      standard: 'EAN-13',
      expectedCheckDigit: expected,
    }
  }
  if (digits.length === 12) {
    const body = digits.slice(0, 11)
    const expected = computeCheckDigit(body, [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3])
    return {
      matched: true,
      valid: expected === digits[11],
      standard: 'UPC-A',
      expectedCheckDigit: expected,
    }
  }
  return { matched: false, valid: true }
}
