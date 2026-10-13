<template>
  <div class="img-field">
    <!-- 隐藏的文件选择器：点击 / 拖拽统一走这里 -->
    <input
      ref="fileRef"
      type="file"
      class="file-input"
      :accept="acceptText"
      @change="onInputChange"
    />

    <!-- 有图：预览 + 文件信息 -->
    <div v-if="modelValue" class="if-body">
      <div class="if-preview" :class="kind" @click="pick">
        <img :src="modelValue" :alt="spec.title" />
        <span class="if-hover"><AppIcon name="upload" :size="15" />替换</span>
      </div>
      <div class="if-info">
        <div class="if-name" :title="asset.name">
          <AppIcon name="image" :size="14" class="nm-ico" />
          <span class="nm-text">{{ asset.name || '自定义图片' }}</span>
          <span class="if-src" :class="isExternal ? 'src-ext' : 'src-up'">{{
            isExternal ? '外链' : '已上传'
          }}</span>
        </div>
        <div class="if-meta">
          <span>实际 {{ asset.outW || '?' }}×{{ asset.outH || '?' }} px</span>
          <span class="dot">·</span>
          <span>{{ sizeText }}</span>
          <span class="dot">·</span>
          <span>{{ asset.mime || '未知格式' }}</span>
        </div>
        <div class="if-verdict" :class="verdict.level">
          <AppIcon :name="verdict.icon" :size="13" />
          <span>{{ verdict.text }}</span>
        </div>
      </div>
    </div>

    <!-- 空态：拖拽上传区 -->
    <div
      v-else
      class="if-drop"
      :class="{ 'is-drag': dragging }"
      @click="pick"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <AppIcon name="upload" :size="20" class="drop-ico" />
      <div class="drop-main">点击或拖拽图片到此处上传</div>
      <div class="drop-sub">{{ dropHint }}</div>
    </div>

    <!-- 操作行 -->
    <div class="if-actions">
      <el-button size="small" :loading="busy" @click="pick">
        <AppIcon name="upload" :size="14" class="btn-ico" />{{ modelValue ? '重新上传' : '选择图片' }}
      </el-button>
      <el-button v-if="modelValue" size="small" @click="clear">
        <AppIcon name="trash" :size="14" class="btn-ico" />移除
      </el-button>
      <el-button size="small" link type="primary" @click="toggleUrlPanel">
        <AppIcon name="link" :size="14" class="btn-ico" />{{ urlPanel ? '收起地址输入' : '使用图片地址' }}
      </el-button>
    </div>

    <!-- 外链输入：保留原有「直接填地址」能力 -->
    <div v-if="urlPanel" class="if-url">
      <el-input
        v-model="urlDraft"
        size="small"
        clearable
        :placeholder="'https://cdn.example.com/' + kind + '.png'"
        @keyup.enter="applyUrl"
      />
      <el-button size="small" type="primary" @click="applyUrl">应用</el-button>
    </div>

    <p v-if="error" class="if-error">
      <AppIcon name="warning" :size="13" />{{ error }}
    </p>

    <!-- 尺寸 / 格式 / 体积规范提示（需求点：尺寸大小要有提示） -->
    <div class="if-spec">
      <span class="sp-item sp-strong">
        <b>建议尺寸</b>{{ spec.recommend }}×{{ spec.recommend }}（1:1 正方形）
      </span>
      <span class="sp-item"><b>最小</b>{{ spec.min }}×{{ spec.min }} px</span>
      <span class="sp-item"><b>格式</b>{{ formatText }}</span>
      <span class="sp-item"><b>体积</b>≤ {{ spec.maxSourceKB }}KB</span>
    </div>
    <p class="if-usage">
      {{ spec.usage }}。上传后自动压缩为 {{ spec.output }}×{{ spec.output }} 并<strong>居中裁切为正方形</strong>，横版图会被裁掉两侧，建议直接上传方图。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { BRAND_ASSET_SPECS, settingsApi, type BrandAssetKind } from '@/api/settings'
import AppIcon from '@/components/AppIcon.vue'

/**
 * 品牌图片上传字段（站点设置 → 站点 LOGO / Favicon）。
 *
 * 为什么自研而非直接用 el-upload：本组件要把「尺寸规范」当成一等公民 ——
 * 上传前校验格式与体积、上传时读取真实像素尺寸并给出合规判定（偏小 / 非方图 / 外链不可校验），
 * 再按规范尺寸压缩裁切，避免运营随手传一张 4MB 手机截图把首页 LOGO 拖慢。
 *
 * 双路一致：压缩后的图片以 dataURL 交给 `settingsApi.uploadAsset`，
 * 演示模式由 mock 直接回吐 dataURL（无需后端），正式模式由后端解码后落对象存储并返回 CDN 地址。
 */
const props = defineProps<{
  /** 图片地址（dataURL 或外链），双向绑定 */
  modelValue: string
  /** 资源类型：logo（站点 LOGO）/ favicon（浏览器标签图标） */
  kind: BrandAssetKind
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

/** 超过该体积时改用更省的编码（演示模式要把图片存进 localStorage，必须控制体积）。 */
const LARGE_BYTES = 400 * 1024

const spec = computed(() => BRAND_ASSET_SPECS[props.kind])
const fileRef = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const dragging = ref(false)
const error = ref('')
const urlPanel = ref(false)
const urlDraft = ref('')

interface AssetMeta {
  name: string
  /** 落盘尺寸（上传压缩后 / 外链探测到的像素尺寸） */
  outW: number
  outH: number
  /** 上传前的原始像素尺寸（判定"偏小 / 非方图"必须看原图，否则被压缩结果掩盖） */
  srcW: number
  srcH: number
  bytes: number
  mime: string
}

function blankMeta(): AssetMeta {
  return { name: '', outW: 0, outH: 0, srcW: 0, srcH: 0, bytes: 0, mime: '' }
}

const asset = ref<AssetMeta>(blankMeta())

/** 刚上传成功的元信息：watch 触发时优先采用，避免被「按地址反查」的结果覆盖。 */
let uploadedMeta: AssetMeta | null = null

const isExternal = computed(() => !!props.modelValue && !props.modelValue.startsWith('data:'))

/** 允许选择的格式（MIME + 扩展名兜底，部分浏览器对 SVG/ICO 不给 MIME）。 */
const acceptText = computed(() =>
  [...spec.value.accept, ...spec.value.ext.map((e) => '.' + e)].join(','),
)
const formatText = computed(() => spec.value.ext.map((e) => e.toUpperCase()).join(' / '))
const dropHint = computed(
  () => `${spec.value.recommend}×${spec.value.recommend} · ${formatText.value} · ≤ ${spec.value.maxSourceKB}KB`,
)
const sizeText = computed(() => (asset.value.bytes ? fmtKB(asset.value.bytes) : '体积未知'))

/** 合规判定：偏小 / 非方图 / 矢量图 / 外链不可校验 / 符合规范。 */
const verdict = computed<{ level: 'ok' | 'warn' | 'info'; icon: string; text: string }>(() => {
  const sp = spec.value
  const a = asset.value
  if (a.mime === 'SVG') {
    return { level: 'ok', icon: 'check', text: '矢量图（SVG），任意尺寸缩放不失真' }
  }
  if (!a.srcW || !a.srcH) {
    return { level: 'info', icon: 'warning', text: '未能读取像素尺寸（外链图片需自行确认符合规范）' }
  }
  const ratio = Math.abs(a.srcW - a.srcH) / Math.max(a.srcW, a.srcH)
  const notSquare = ratio > 0.04
  const original = `原图 ${a.srcW}×${a.srcH}`
  if (Math.min(a.srcW, a.srcH) < sp.min) {
    return {
      level: 'warn',
      icon: 'warning',
      text: `${original} 低于最小 ${sp.min}×${sp.min}，放大后可能模糊，建议重新上传 ${sp.recommend}×${sp.recommend}`,
    }
  }
  if (notSquare) {
    return isExternal.value
      ? { level: 'warn', icon: 'warning', text: `非 1:1 方图（${a.srcW}×${a.srcH}），展示时会被居中裁切` }
      : {
          level: 'warn',
          icon: 'warning',
          text: `${original} 非 1:1，已居中裁切为 ${a.outW}×${a.outH}（两侧内容被裁掉），建议改用方图`,
        }
  }
  const shrunk = a.outW && a.outW < a.srcW ? `，已压缩为 ${a.outW}×${a.outH}` : ''
  return { level: 'ok', icon: 'check', text: `尺寸符合规范（${original}${shrunk}）` }
})

// ===== 工具：读取 / 压缩 / 尺寸探测 =====

/** 文件 → dataURL。 */
function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败，请重试'))
    reader.readAsDataURL(file)
  })
}

/** 图片解码（用于取真实像素尺寸）。 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () =>
      reject(new Error('无法读取该图片，请确认文件未损坏且为 PNG / JPG / WebP / SVG'))
    img.src = src
  })
}

/** dataURL 的体积（base64 段长度 × 3/4）。 */
function dataUrlBytes(dataUrl: string): number {
  return Math.round(((dataUrl.split(',')[1] ?? '').length * 3) / 4)
}

function fmtKB(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  return bytes >= 1024 * 1024
    ? (bytes / 1024 / 1024).toFixed(2) + ' MB'
    : Math.round(bytes / 1024) + ' KB'
}

/** 从地址推断展示用格式名（dataURL 取 MIME 后缀，外链取扩展名）。 */
function mimeOf(url: string): string {
  if (url.startsWith('data:')) {
    const mime = url.slice(5, url.indexOf(';'))
    if (mime === 'image/svg+xml') return 'SVG'
    return mime.replace('image/', '').toUpperCase()
  }
  const ext = (url.split('?')[0].split('.').pop() ?? '').toUpperCase()
  return ext.length <= 5 ? ext : ''
}

/** 居中裁切 + 等比缩放为 size×size 的正方形，并按需降级编码以控制体积。 */
function encodeSquare(img: HTMLImageElement, size: number): { dataUrl: string; width: number } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片压缩，请更换浏览器后重试')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  // cover 语义：短边撑满画布，长边居中裁切 —— 与侧栏正方形 LOGO 的展示方式一致，不会拉伸变形。
  const scale = size / Math.min(img.naturalWidth, img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)

  let dataUrl = canvas.toDataURL('image/png')
  if (dataUrlBytes(dataUrl) > LARGE_BYTES) {
    const webp = canvas.toDataURL('image/webp', 0.92)
    if (webp.startsWith('data:image/webp')) dataUrl = webp
  }
  if (dataUrlBytes(dataUrl) > LARGE_BYTES) {
    // 最后兜底：转 JPEG（不支持透明通道，先铺白底避免透明区域变黑）。
    const flat = document.createElement('canvas')
    flat.width = size
    flat.height = size
    const fctx = flat.getContext('2d')
    if (fctx) {
      fctx.fillStyle = '#ffffff'
      fctx.fillRect(0, 0, size, size)
      fctx.drawImage(canvas, 0, 0)
      dataUrl = flat.toDataURL('image/jpeg', 0.9)
    }
  }
  return { dataUrl, width: size }
}

// ===== 上传流程 =====
function pick(): void {
  if (busy.value) return
  fileRef.value?.click()
}

function onInputChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许重复选择同一文件
  if (file) void handleFile(file)
}

function onDrop(e: DragEvent): void {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

async function handleFile(file: File): Promise<void> {
  const sp = spec.value
  error.value = ''
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!sp.accept.includes(file.type) && !sp.ext.includes(ext)) {
    error.value = `格式不支持：仅接受 ${formatText.value}`
    ElMessage.warning(error.value)
    return
  }
  if (file.size > sp.maxSourceKB * 1024) {
    error.value = `原图 ${fmtKB(file.size)} 超过体积上限 ${sp.maxSourceKB}KB，请先压缩后再上传`
    ElMessage.warning(error.value)
    return
  }

  busy.value = true
  try {
    const raw = await readAsDataURL(file)
    const isSvg = file.type === 'image/svg+xml' || ext === 'svg'
    let dataUrl = raw
    let outW = 0
    let outH = 0
    let srcW = 0
    let srcH = 0
    if (isSvg) {
      // 矢量图不栅格化（放大不糊），仅探测视口尺寸用于提示。
      const probe = await loadImage(raw).catch(() => null)
      srcW = probe?.naturalWidth ?? 0
      srcH = probe?.naturalHeight ?? 0
      outW = srcW
      outH = srcH
    } else {
      const img = await loadImage(raw)
      srcW = img.naturalWidth
      srcH = img.naturalHeight
      const out = encodeSquare(img, sp.output)
      dataUrl = out.dataUrl
      outW = sp.output
      outH = sp.output
    }

    const res = await settingsApi.uploadAsset({
      kind: sp.kind,
      dataUrl,
      name: file.name,
      width: outW,
      height: outH,
    })
    uploadedMeta = {
      name: file.name,
      outW,
      outH,
      srcW: srcW || res.width,
      srcH: srcH || res.height,
      bytes: res.bytes,
      mime: mimeOf(res.url),
    }
    asset.value = { ...uploadedMeta }
    emit('update:modelValue', res.url)
    ElMessage.success(
      `${sp.title}已上传：${outW}×${outH} · ${fmtKB(res.bytes)}（保存设置后生效）`,
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    ElMessage.error('上传失败：' + error.value)
  } finally {
    busy.value = false
  }
}

/** 移除当前图片（仅清空字段，保存设置后才会真正生效）。 */
function clear(): void {
  error.value = ''
  uploadedMeta = null
  asset.value = blankMeta()
  emit('update:modelValue', '')
}

function toggleUrlPanel(): void {
  urlPanel.value = !urlPanel.value
  if (urlPanel.value) urlDraft.value = props.modelValue.startsWith('data:') ? '' : props.modelValue
}

/** 应用外链地址（保留原有的「填地址」用法，例如已上传到自有 CDN 的图）。 */
function applyUrl(): void {
  const url = urlDraft.value.trim()
  if (!url) {
    ElMessage.warning('请输入图片地址')
    return
  }
  if (!/^(https?:)?\/\//.test(url) && !url.startsWith('/')) {
    ElMessage.warning('地址需为 http(s) 链接或以 / 开头的站内路径')
    return
  }
  error.value = ''
  uploadedMeta = null
  emit('update:modelValue', url)
  urlPanel.value = false
  ElMessage.success('已应用图片地址，保存设置后生效')
}

// ===== 回显：按当前地址反查尺寸/体积，保证打开页面就能看到"实际多大" =====
watch(
  () => props.modelValue,
  async (url) => {
    if (!url) {
      asset.value = blankMeta()
      return
    }
    if (uploadedMeta) {
      asset.value = { ...uploadedMeta }
      uploadedMeta = null
      return
    }
    const meta = blankMeta()
    if (url.startsWith('data:')) {
      meta.name = '已上传图片'
      meta.bytes = dataUrlBytes(url)
      meta.mime = mimeOf(url)
    } else {
      meta.name = decodeURIComponent(url.split('?')[0].split('/').pop() || '外链图片')
      meta.mime = mimeOf(url)
    }
    asset.value = meta
    const img = await loadImage(url).catch(() => null)
    if (img) {
      asset.value = {
        ...asset.value,
        outW: img.naturalWidth,
        outH: img.naturalHeight,
        srcW: img.naturalWidth,
        srcH: img.naturalHeight,
      }
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.img-field {
  width: 100%;
}
.file-input {
  display: none;
}
.btn-ico {
  margin-right: 5px;
}

/* 预览 + 信息 */
.if-body {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--bg);
}
.if-preview {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: var(--sh-1);
}
.if-preview.logo {
  width: 84px;
  height: 84px;
  border-radius: 14px;
}
.if-preview.favicon {
  width: 60px;
  height: 60px;
  border-radius: 10px;
}
.if-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.if-hover {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: 11px;
  color: #fff;
  background: rgba(15, 23, 42, 0.62);
  opacity: 0;
  transition: opacity 0.18s var(--ease);
}
.if-preview:hover .if-hover {
  opacity: 1;
}

.if-info {
  min-width: 0;
  flex: 1;
}
.if-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.nm-ico {
  color: var(--ink-400);
}
.nm-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.if-src {
  flex: none;
  font-size: 11px;
  padding: 1px 7px;
  border-radius: var(--r-pill);
  font-weight: 600;
}
.src-up {
  color: #0e7490;
  background: #ecfeff;
}
.src-ext {
  color: #b45309;
  background: #fffbeb;
}
.if-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  font-size: 12px;
  color: var(--ink-500);
}
.if-meta .dot {
  color: var(--ink-300);
}
.if-verdict {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.5;
  padding: 5px 8px;
  border-radius: var(--r-sm);
}
.if-verdict.ok {
  color: #15803d;
  background: var(--green-soft);
}
.if-verdict.warn {
  color: #b45309;
  background: var(--amber-soft);
}
.if-verdict.info {
  color: var(--ink-600);
  background: var(--line-soft);
}

/* 空态拖拽区 */
.if-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 20px 12px;
  border: 1.5px dashed var(--line-strong, #d6dfec);
  border-radius: var(--r-md);
  background: var(--bg);
  cursor: pointer;
  transition:
    border-color 0.18s var(--ease),
    background 0.18s var(--ease);
}
.if-drop:hover,
.if-drop.is-drag {
  border-color: var(--brand-400);
  background: var(--brand-soft);
}
.drop-ico {
  color: var(--brand-500);
}
.drop-main {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-700);
}
.drop-sub {
  font-size: 11.5px;
  color: var(--ink-400);
}

/* 规范提示条 */
.if-spec {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.sp-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: var(--ink-600);
  background: var(--line-soft);
  border: 1px solid var(--line);
  padding: 3px 9px;
  border-radius: var(--r-pill);
}
.sp-item b {
  font-weight: 600;
  color: var(--ink-400);
}
.sp-strong {
  color: var(--brand-700);
  background: var(--brand-soft);
  border-color: #dbe3ff;
}
.sp-strong b {
  color: var(--brand-600);
}
.if-usage {
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-400);
}
.if-usage strong {
  color: var(--ink-600);
}

/* 操作行 */
.if-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.if-url {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.if-error {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--red-500);
}
</style>
