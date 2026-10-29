/**
 * Code128B 零依赖编码器（任务 7.2 · 采购单收货标签打印）。
 *
 * 为什么不用第三方库：标签打印是一次性能力，引入 npm 依赖会增加本机沙箱/网络安装风险，
 * 且仓库已约定「单点能力尽量零依赖」。Code128B 算法固定、可独立验证，自研更可控。
 *
 * 字符集 B：覆盖可打印 ASCII 32(空格) ~ 127(DEL)，共 95 个字符；
 *   码值映射：value = ascii - 32（空格→0，~→94，DEL→95）。
 * 校验位：加权求和 mod 103，权重从数据首字符起为 1、2、3…；起始符 StartB=104 计入权重 1 项（无乘权）。
 * 终止：Stop=106 之后追加 2 个模块宽的终止黑条（Code128 规范要求）。
 *
 * 导出：
 *  - code128Values(text)：返回 [StartB, ...数据码值, 校验码值, Stop]，便于单测断言校验位。
 *  - code128Bars(text)：返回整段符号的「模块宽度序列」(number[])，黑/白交替、以黑条起；含静区外的全部条空 + 终止条。
 *  - code128SvgRects(text, opts)：返回自包含 SVG 字符串（白底 + 黑条 + 可选明文），供打印标签直接内嵌。
 */

/** StartB / Stop 码值（Code128 规范固定） */
export const START_B = 104
export const STOP = 106

/**
 * 码值 0..106 对应的 6 元素条空宽度串（bar,space,bar,space,bar,space；每字符固定 11 个模块）。
 * 来源：Code128 规范字符图案表（GS1/ISO/IEC 15417），与公开实现一致。
 */
const PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '233111',
]

/** 单字符码值（ASCII 32-127 → 0-95）；越界抛错 */
function charValue(ch: string): number {
  const code = ch.charCodeAt(0)
  if (code < 32 || code > 127) {
    throw new Error(`Code128B 仅支持可打印 ASCII(32-127)，字符 "${ch}"(码值 ${code}) 不在范围内`)
  }
  return code - 32
}

/**
 * 返回码值序列 [StartB, ...数据码值, 校验码值, Stop]。
 * 校验位 = (StartB + Σ 数据码值×位置) mod 103，位置从 1 开始。
 */
export function code128Values(text: string): number[] {
  const values: number[] = [START_B]
  let checksum = START_B
  let pos = 1
  for (const ch of text) {
    const v = charValue(ch)
    values.push(v)
    checksum += v * pos
    pos += 1
  }
  values.push(checksum % 103)
  values.push(STOP)
  return values
}

/**
 * 返回整段符号的模块宽度序列（number[]）：黑/白交替、首元素为黑条宽度。
 * 含 StartB + 数据 + 校验 + Stop 的全部条空，以及末尾 2 模块宽的终止黑条。
 */
export function code128Bars(text: string): number[] {
  const values = code128Values(text)
  const bars: number[] = []
  for (const v of values) {
    const pat = PATTERNS[v]
    if (!pat) {
      // 码值越界（理论上不会，因 charValue 已拦截），防御性抛错
      throw new Error(`Code128 码值 ${v} 无对应图案，文本可能含不可编码字符`)
    }
    for (const d of pat) bars.push(Number(d))
  }
  bars.push(2) // 终止条：2 模块宽黑条
  return bars
}

export interface Code128SvgOptions {
  /** 单个模块宽度（px），默认 2 */
  moduleWidth?: number
  /** 条码高度（px），默认 60 */
  height?: number
  /** 是否显示底部明文，默认 true */
  showText?: boolean
  /** 明文字号（px），默认 14 */
  fontSize?: number
  /** 左右静区模块数（每侧），默认 10（Code128 规范要求 ≥10X） */
  quietZone?: number
}

/**
 * 生成自包含 SVG 字符串：白底 + 黑条 + 可选底部明文。
 * 可直接内嵌到打印标签（<img src="data:image/svg+xml;..."> 或 v-html）。
 */
export function code128SvgRects(text: string, opts: Code128SvgOptions = {}): string {
  const moduleWidth = opts.moduleWidth ?? 2
  const height = opts.height ?? 60
  const showText = opts.showText ?? true
  const fontSize = opts.fontSize ?? 14
  const quiet = opts.quietZone ?? 10

  const bars = code128Bars(text)
  const totalModules = bars.reduce((sum, w) => sum + w, 0)
  const quietModules = quiet * 2
  const contentWidth = (totalModules + quietModules) * moduleWidth
  const textHeight = showText ? fontSize + 4 : 0
  const svgWidth = contentWidth
  const svgHeight = height + textHeight

  // 累积 x，黑条画矩形、白条跳过（依赖白色背景）
  let x = quiet * moduleWidth
  let rects = ''
  bars.forEach((w, i) => {
    const wPx = w * moduleWidth
    if (i % 2 === 0) {
      // 偶数索引 = 黑条
      rects += `<rect x="${x}" y="0" width="${wPx}" height="${height}" fill="#000"/>`
    }
    x += wPx
  })

  const textSvg = showText
    ? `<text x="${svgWidth / 2}" y="${height + fontSize}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="#000">${escapeXml(text)}</text>`
    : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">` +
    `<rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="#fff"/>` +
    rects +
    textSvg +
    `</svg>`
  )
}

/** XML 转义（明文可能含 & < > 等） */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
