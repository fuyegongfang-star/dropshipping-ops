/**
 * 条码规则引擎（6.12 扫码输入层 · 解析层）
 *
 * 设计原则：
 * 1) **设备无关**——扫码枪（HID 键盘模拟）、PDA（扫描头直出）、手机摄像头，只要最终给得出
 *    一个字符串就能接入，不依赖任何厂商 SDK / 驱动。设备差异在「输入层」被抹平。
 * 2) **查询优先**——号段正则只用于「提示与日志」，真正判定以数据库命中为准。
 *    （EAN-13 条码与 13 位快递单号在文本上无法区分，只能靠查库解决。）
 * 3) **可扩展**——新增快递商 / 新码制只需往规则表追加一条，不动解析主流程。
 */

/** 扫码值的语义类型（unknown = 号段无法判定，需人工确认） */
export type ScanKind = 'trackingNo' | 'barcode' | 'purchaseNo' | 'unknown'

interface ScanRule {
  kind: Exclude<ScanKind, 'unknown'>
  /** 号段说明，用于扫描日志与错误提示，便于现场排查「扫了什么」 */
  label: string
  test: RegExp
}

/** 采购单号：内部单号（po_/PO-）或业务前缀（CG=采购） */
const PURCHASE_NO_RULES: ScanRule[] = [
  { kind: 'purchaseNo', label: '内部采购单号', test: /^po[_-]/i },
  { kind: 'purchaseNo', label: '采购单号', test: /^CG\d{6,}$/i },
]

/** 快递单号：字母前缀优先（顺丰/圆通/中通/申通/韵达/EMS/京东 …） */
const TRACKING_PREFIX_RULES: ScanRule[] = [
  { kind: 'trackingNo', label: '顺丰/圆通/中通/申通/韵达/EMS/京东', test: /^(SF|YT|ZTO|STO|YD|EMS|JD|DBL|ZT)[A-Z0-9]{8,}$/i },
  { kind: 'trackingNo', label: '国际邮政 S10 格式', test: /^[A-Z]{2}\d{9}[A-Z]{2}$/i },
  { kind: 'trackingNo', label: 'UPS/FedEx/DHL 国际件', test: /^(1Z|7\d{11}|\d{12,14})$/ },
]

/** 商品条码：定长数字码制（EAN-8 / UPC-A / EAN-13 / ITF-14 箱码） */
const BARCODE_RULES: ScanRule[] = [
  { kind: 'barcode', label: 'EAN-8 商品条码', test: /^\d{8}$/ },
  { kind: 'barcode', label: 'UPC-A 商品条码', test: /^\d{12}$/ },
  { kind: 'barcode', label: 'EAN-13 商品条码', test: /^\d{13}$/ },
  { kind: 'barcode', label: 'ITF-14 箱码', test: /^\d{14}$/ },
]

/** 兜底：长串纯数字按快递单号处理（多数国内快递面单即纯数字） */
const TRACKING_FALLBACK_RULES: ScanRule[] = [
  { kind: 'trackingNo', label: '纯数字快递单号', test: /^\d{10,30}$/ },
]

/**
 * 归一化扫码值：
 * - 去首尾空白与所有内嵌空白（扫码枪偶发带空格/换行）；
 * - 去常见包裹符（部分 PDA 会带 <> 或 []）；
 * - 不做大小写转换（快递单号大小写均有意义，交由号段规则忽略大小写）。
 */
export function normalizeScanValue(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^[<[(]+/, '').replace(/[>)\]]+$/, '')
}

/**
 * 按号段猜测扫码值语义（仅用于提示与日志，不作为唯一判定依据）。
 * 顺序：采购单号 → 带字母前缀的快递单号 → 定长商品条码 → 纯数字快递单号。
 */
export function guessScanKind(value: string): { kind: ScanKind; label: string } {
  const v = normalizeScanValue(value)
  if (!v) return { kind: 'unknown', label: '空扫码值' }
  const matched = [...PURCHASE_NO_RULES, ...TRACKING_PREFIX_RULES, ...BARCODE_RULES, ...TRACKING_FALLBACK_RULES].find(
    (r) => r.test.test(v),
  )
  return matched ? { kind: matched.kind, label: matched.label } : { kind: 'unknown', label: '未识别号段' }
}

/** 语义类型中文名（统一前后端文案） */
export const SCAN_KIND_LABELS: Record<ScanKind, string> = {
  trackingNo: '快递单号',
  barcode: '商品条码',
  purchaseNo: '采购单号',
  unknown: '未识别',
}

/** 给「扫不到」场景用的排查提示（号段 + 示例），降低现场沟通成本 */
export function scanMissHint(value: string): string {
  const g = guessScanKind(value)
  if (g.kind === 'unknown') return '未能识别该扫码值的号段，且未匹配到采购单'
  return `已识别为${g.label}（${SCAN_KIND_LABELS[g.kind]}），但未匹配到采购单`
}
