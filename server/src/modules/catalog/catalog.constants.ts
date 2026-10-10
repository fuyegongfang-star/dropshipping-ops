/**
 * 商品/SKU 中心常量（任务 1.7，方案 §1 商品映射 / §4 运费试算）。
 * 集中管理计费重相关口径，避免魔法数字（§31）。
 */

/** 体积重抛比系数（cm³/g）：国际快递通用 6000；体积重 = 长×宽×高 ÷ 抛比。 */
export const DEFAULT_VOLUMETRIC_DIVISOR = 6000

/** 计费重口径：取「实重」与「体积重」的较大值（§4 计费重口径）。 */
export const CHARGEABLE_WEIGHT_RULE = 'max(weightG, volumetricWeightG)' as const
