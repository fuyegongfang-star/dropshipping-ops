/**
 * 计费重 / 抛重计算（方案 §4.2 货代试算核心：计费重 = max(实重, 体积重)）。
 * 多箱：各箱计费重 Σ（按产品规则，§4.2）。
 * 体积重 = 长×宽×高 ÷ 抛比系数（常见 5000/6000，按渠道/产品配置，§4.2）。
 *
 * 负责人：自动开发引擎 ｜ 最后修订：2026-10-11
 */

/** 单箱重量/尺寸（重量 kg，尺寸 cm） */
export interface ParcelDimension {
  weightKg: number // 实重（kg）
  lengthCm: number // 长（cm）
  widthCm: number // 宽（cm）
  heightCm: number // 高（cm）
}

/** 单箱计费重计算结果 */
export interface ParcelWeight {
  weightKg: number // 实重（kg）
  volumetricKg: number // 体积重（kg）= L*W*H/divisor
  chargeableKg: number // 计费重（kg）= max(实重, 体积重)
  isVolumetric: boolean // 是否抛货（体积重 > 实重）
}

/** 默认抛比系数（§4.2 常见 5000） */
export const DEFAULT_VOLUMETRIC_DIVISOR = 5000

/**
 * 计算单箱计费重。
 * @param parcel 单箱尺寸/重量
 * @param divisor 抛比系数（默认 5000）
 */
export function computeParcelWeight(
  parcel: ParcelDimension,
  divisor: number = DEFAULT_VOLUMETRIC_DIVISOR,
): ParcelWeight {
  // 体积重：尺寸乘积 ÷ 抛比系数（除零保护，系数非法时回退默认）
  const safeDivisor = divisor > 0 ? divisor : DEFAULT_VOLUMETRIC_DIVISOR
  const volumetricKg = (parcel.lengthCm * parcel.widthCm * parcel.heightCm) / safeDivisor
  const chargeableKg = Math.max(parcel.weightKg, volumetricKg)
  return {
    weightKg: parcel.weightKg,
    volumetricKg,
    chargeableKg,
    isVolumetric: volumetricKg > parcel.weightKg,
  }
}

/**
 * 计算多箱总计费重（§4.2 多箱 Σ 各箱计费重）。
 * 返回总计费重、总体积重与是否含抛货，供比价/建单复用。
 */
export function computeChargeableWeight(
  parcels: ParcelDimension[],
  divisor: number = DEFAULT_VOLUMETRIC_DIVISOR,
): { totalChargeableKg: number; totalVolumetricKg: number; isVolumetric: boolean } {
  let totalChargeableKg = 0
  let totalVolumetricKg = 0
  let isVolumetric = false
  for (const p of parcels) {
    const w = computeParcelWeight(p, divisor)
    totalChargeableKg += w.chargeableKg
    totalVolumetricKg += w.volumetricKg
    if (w.isVolumetric) isVolumetric = true
  }
  return { totalChargeableKg, totalVolumetricKg, isVolumetric }
}
