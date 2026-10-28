/**
 * 扫码输入层（任务 6.12）——**设备无关**的一层，位于所有扫码业务之上。
 *
 * ## 为什么不需要对接厂商 SDK
 * 市面上绝大多数扫码枪（有线 / 无线 / 蓝牙）出厂默认就是 **HID 键盘模拟（Keyboard Wedge）**
 * 模式：扣一次扳机 = 以极快速度"键入"一串字符 + 一个结束符（默认回车）。
 * 对操作系统和浏览器而言，它**就是个键盘**，不需要驱动、不需要串口程序、不需要任何 SDK。
 *
 * 因此适配策略是：
 * - **扫码枪 / 蓝牙枪 / 固定式扫描平台** → 本文件直接搞定，任意品牌通用；
 * - **PDA（安卓手持终端）** → 在其扫描 APP 里把输出模式设为「键盘输出 / Keystroke」，
 *   同样等价于键盘，本文件照样通用（这是最省事的 PDA 接入方式）；
 *   若要走「广播 Intent / 厂商 SDK」取数，则需一个原生壳把数据转成键盘事件或调 HTTP 接口，
 *   那属于设备侧定制，与本层通过同一个 `onScan(value)` 入口对接即可。
 *
 * ## 难点：如何与人工打字区分
 * 人工击键间隔通常 > 80ms；扫码枪整串输出间隔通常 < 35ms（高端枪 < 15ms）。
 * 本层记录每次击键间隔，命中阈值即标记为"扫码枪输入"，可在界面上显示来源，便于现场排查。
 *
 * ## 使用
 * ```ts
 * const { lastScan, isScannerInput } = useScannerInput({ onScan: (v) => doScan(v) })
 * ```
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'

/** 结束符：多数扫码枪默认回车；部分可配 Tab；none = 不发送结束符，靠停顿超时判定 */
export type ScanEndKey = 'Enter' | 'Tab' | 'none'

export interface ScanConfig {
  /** 是否启用全局键盘钩子（关闭后仅手动输入） */
  enabled: boolean
  endKey: ScanEndKey
  /** 扫完自动提交（连续扫描模式的核心）；关闭则需人工点确认 */
  autoSubmit: boolean
  /** 判定为"扫码枪"的最大平均击键间隔（ms），人工打字一般 > 80ms */
  maxIntervalMs: number
  /** 有效扫码值最小长度，过滤误触 */
  minLength: number
  /** 需要剥离的前缀（少数枪会输出控制字符或固定前缀） */
  stripPrefix: string
  /** 需要剥离的后缀（同上） */
  stripSuffix: string
  /** 提示音：成功/失败不同音色 */
  beep: boolean
}

export const DEFAULT_SCAN_CONFIG: ScanConfig = {
  enabled: true,
  endKey: 'Enter',
  autoSubmit: true,
  maxIntervalMs: 35,
  minLength: 4,
  stripPrefix: '',
  stripSuffix: '',
  beep: true,
}

const STORAGE_KEY = 'dso.scan-config'

function loadConfig(): ScanConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SCAN_CONFIG }
    return { ...DEFAULT_SCAN_CONFIG, ...(JSON.parse(raw) as Partial<ScanConfig>) }
  } catch {
    return { ...DEFAULT_SCAN_CONFIG }
  }
}

/** 全局单例配置：设备设置在任意页面改动，所有扫码入口即时生效 */
export const scanConfig = ref<ScanConfig>(loadConfig())

export function saveScanConfig(next: Partial<ScanConfig>): void {
  scanConfig.value = { ...scanConfig.value, ...next }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scanConfig.value))
}

export function resetScanConfig(): void {
  scanConfig.value = { ...DEFAULT_SCAN_CONFIG }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scanConfig.value))
}

/** 按配置剥离前后缀并去空白（与后端 normalizeScanValue 保持一致） */
export function normalizeScanValue(value: string): string {
  const { stripPrefix, stripSuffix } = scanConfig.value
  let v = value.replace(/\s+/g, '')
  if (stripPrefix && v.startsWith(stripPrefix)) v = v.slice(stripPrefix.length)
  if (stripSuffix && v.endsWith(stripSuffix)) v = v.slice(0, -stripSuffix.length)
  return v
}

// —— 提示音：WebAudio 合成，零依赖；成功高音短促，失败低音双击 ——
let audioCtx: AudioContext | null = null
function tone(freq: number, ms: number, delay = 0): void {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioCtx = audioCtx ?? new Ctor()
    const start = audioCtx.currentTime + delay / 1000
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.06, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start(start)
    osc.stop(start + ms / 1000 + 0.02)
  } catch {
    // 浏览器未授权音频时静默降级，不影响扫码
  }
}

export const scanSound = {
  ok: (): void => {
    if (scanConfig.value.beep) tone(880, 90)
  },
  fail: (): void => {
    if (!scanConfig.value.beep) return
    tone(220, 110)
    tone(180, 150, 130)
  },
}

export interface UseScannerInputOptions {
  /** 识别到一次完整扫码时回调（已按配置归一化） */
  onScan: (value: string) => void
  /** 额外开关（如弹窗未打开时不监听），与全局 config.enabled 取交集 */
  active?: () => boolean
}

export function useScannerInput(opts: UseScannerInputOptions) {
  let buffer = ''
  let lastKeyAt = 0
  let firstKeyAt = 0
  let idleTimer: number | undefined

  /** 最近一次扫码的原始值 */
  const lastScan = ref('')
  /** 最近一次扫码的平均击键间隔（ms）——用于设备设置页「扫码枪诊断」 */
  const lastSpeed = ref(0)
  /** 最近一次是否被判定为扫码枪输入（而非人工打字） */
  const isScannerInput = ref(false)

  function flush(): void {
    window.clearTimeout(idleTimer)
    const raw = buffer
    buffer = ''
    if (!raw) return
    const value = normalizeScanValue(raw)
    if (value.length < scanConfig.value.minLength) return
    const total = raw.length
    // 平均击键间隔：末次击键时间 - 首次击键时间 / 间隔数（比用 Date.now() 更准，不受回调延迟影响）
    const speed = total > 1 ? Math.round((lastKeyAt - firstKeyAt) / (total - 1)) : 0
    lastSpeed.value = speed
    isScannerInput.value = speed > 0 && speed <= scanConfig.value.maxIntervalMs
    lastScan.value = value
    opts.onScan(value)
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!scanConfig.value.enabled) return
    if (opts.active && !opts.active()) return

    // 结束符：立即提交（扫码枪最常见的收尾方式）
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (scanConfig.value.endKey === e.key) {
        // 输入框内由扫码枪以回车收尾时，阻止表单默认提交行为，改走扫码流程
        if (buffer) e.preventDefault()
        flush()
      }
      return
    }
    if (e.key === 'Escape') {
      buffer = ''
      window.clearTimeout(idleTimer)
      return
    }
    // 仅累积可打印单字符（排除 Shift/Ctrl/方向键等控制键）
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return

    const now = Date.now()
    if (!buffer) firstKeyAt = now
    buffer += e.key
    lastKeyAt = now

    // 结束符为 none（部分枪不发送回车）或开启自动提交时：停顿即提交
    if (scanConfig.value.endKey === 'none' || scanConfig.value.autoSubmit) {
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(flush, scanConfig.value.endKey === 'none' ? 60 : 120)
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown, true))
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeyDown, true)
    window.clearTimeout(idleTimer)
  })

  return {
    lastScan,
    lastSpeed,
    isScannerInput,
    flushNow: flush,
    clear: () => {
      buffer = ''
    },
  }
}
