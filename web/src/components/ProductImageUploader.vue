<template>
  <div class="pu">
    <!-- 隐藏文件选择器：支持一次选多张 -->
    <input
      ref="fileRef"
      type="file"
      class="pu-file"
      accept="image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif"
      multiple
      @change="onChange"
    />

    <div v-if="list.length" class="pu-grid">
      <div v-for="(url, i) in list" :key="i" class="pu-item">
        <img :src="url" :alt="`产品图 ${i + 1}`" />
        <span class="pu-del" title="移除" @click="remove(i)">
          <AppIcon name="close" :size="12" />
        </span>
        <span class="pu-tag" :class="isData(url) ? 'tag-up' : 'tag-ext'">
          {{ isData(url) ? '已上传' : '外链' }}
        </span>
      </div>
    </div>
    <div v-else class="pu-empty">
      <AppIcon name="image" :size="18" />
      <span>暂无产品图</span>
    </div>

    <div class="pu-actions">
      <el-button size="small" :loading="busy" @click="pick">
        <AppIcon name="upload" :size="14" class="btn-ico" />上传产品图
      </el-button>
      <el-button size="small" link type="primary" @click="urlPanel = !urlPanel">
        <AppIcon name="link" :size="14" class="btn-ico" />{{ urlPanel ? '收起地址输入' : '用图片地址' }}
      </el-button>
      <span v-if="list.length" class="pu-count">共 {{ list.length }} 张</span>
    </div>

    <div v-if="urlPanel" class="pu-url">
      <el-input
        v-model="urlDraft"
        size="small"
        clearable
        placeholder="https://cdn.example.com/product.jpg"
        @keyup.enter="applyUrl"
      />
      <el-button size="small" type="primary" @click="applyUrl">添加</el-button>
    </div>

    <p v-if="error" class="pu-error">
      <AppIcon name="warning" :size="13" />{{ error }}
    </p>

    <p class="pu-tip">
      可一次选多张；上传后自动<strong>等比缩放</strong>至最长边 {{ MAX_EDGE }}px（不裁切，保留商品完整外观）。
      关联店铺订单时会自动带出该订单商品主图，你可在此基础上增补实拍图。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppIcon from '@/components/AppIcon.vue'

/**
 * 产品图上传器（采购单录入，任务 6.11）。
 *
 * 与站点品牌图（ImageUploadField，正方形裁切）不同：产品图必须保留完整外观，
 * 故只做「等比缩放」不做裁切；多图管理，同时保留原有的「直接填图片地址」用法。
 *
 * 双路一致：演示模式压缩后的 dataURL 直接存内存 / localStorage；
 * 正式模式后端会将其解码后落对象存储并返回 CDN 地址（字段形状一致，无需改造视图）。
 */
const props = defineProps<{
  /** 产品图地址列表（dataURL 或外链） */
  modelValue: string[]
  /** 单文件体积上限（KB） */
  maxKB?: number
}>()

const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

/** 压缩后的最长边（px）：够看清商品细节，又不至于把演示态存储撑爆 */
const MAX_EDGE = 800
const LARGE_BYTES = 400 * 1024

const fileRef = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref('')
const urlPanel = ref(false)
const urlDraft = ref('')

const list = computed(() => props.modelValue ?? [])

function isData(url: string): boolean {
  return url.startsWith('data:')
}

function pick(): void {
  if (busy.value) return
  fileRef.value?.click()
}

function onChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = '' // 允许重复选择同一批文件
  if (files.length) void handleFiles(files)
}

async function handleFiles(files: File[]): Promise<void> {
  error.value = ''
  const maxKB = props.maxKB ?? 5 * 1024
  const ok: File[] = []
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      error.value = `已跳过非图片文件：${f.name}`
      continue
    }
    if (f.size > maxKB * 1024) {
      error.value = `${f.name} 体积 ${fmtKB(f.size)} 超过上限 ${maxKB}KB，已跳过`
      continue
    }
    ok.push(f)
  }
  if (!ok.length) {
    ElMessage.warning(error.value || '没有可上传的图片')
    return
  }

  busy.value = true
  const added: string[] = []
  try {
    for (const f of ok) {
      const raw = await readAsDataURL(f)
      const img = await loadImage(raw)
      const dataUrl = encodeFit(img)
      added.push(dataUrl)
    }
    emit('update:modelValue', [...list.value, ...added])
    ElMessage.success(`已添加 ${added.length} 张产品图（等比缩放至最长边 ${MAX_EDGE}px）`)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    ElMessage.error('上传失败：' + error.value)
  } finally {
    busy.value = false
  }
}

function remove(i: number): void {
  const next = [...list.value]
  next.splice(i, 1)
  emit('update:modelValue', next)
}

function applyUrl(): void {
  const url = urlDraft.value.trim()
  if (!url) {
    ElMessage.warning('请输入图片地址')
    return
  }
  if (!/^(https?:)?\/\//.test(url) && !url.startsWith('/') && !url.startsWith('data:')) {
    ElMessage.warning('地址需为 http(s) 链接、站内路径或 data URL')
    return
  }
  if (list.value.includes(url)) {
    ElMessage.warning('该图片地址已存在')
    return
  }
  emit('update:modelValue', [...list.value, url])
  urlDraft.value = ''
  urlPanel.value = false
  ElMessage.success('已添加图片地址')
}

// ===== 工具 =====

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取文件失败，请重试'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法读取该图片，请确认文件未损坏'))
    img.src = src
  })
}

function dataUrlBytes(dataUrl: string): number {
  return Math.round(((dataUrl.split(',')[1] ?? '').length * 3) / 4)
}

function fmtKB(bytes: number): string {
  if (!bytes) return '—'
  return bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : Math.round(bytes / 1024) + ' KB'
}

/** 等比缩放：最长边压到 MAX_EDGE，不裁切（保留商品完整外观） */
function encodeFit(img: HTMLImageElement): string {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持图片压缩，请更换浏览器后重试')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, tw, th)

  let dataUrl = canvas.toDataURL('image/png')
  if (dataUrlBytes(dataUrl) > LARGE_BYTES) {
    const webp = canvas.toDataURL('image/webp', 0.92)
    if (webp.startsWith('data:image/webp')) dataUrl = webp
  }
  if (dataUrlBytes(dataUrl) > LARGE_BYTES) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  }
  return dataUrl
}
</script>

<style scoped>
.pu {
  width: 100%;
}
.pu-file {
  display: none;
}
.btn-ico {
  margin-right: 5px;
}

.pu-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 10px;
}
.pu-item {
  position: relative;
  width: 84px;
  height: 84px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  overflow: hidden;
  background: #fff;
}
.pu-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pu-del {
  position: absolute;
  top: 3px;
  right: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: #fff;
  background: rgba(15, 23, 42, 0.66);
  cursor: pointer;
}
.pu-del:hover {
  background: var(--red-500, #ef4444);
}
.pu-tag {
  position: absolute;
  left: 3px;
  bottom: 3px;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--r-pill);
  font-weight: 600;
}
.tag-up {
  color: #0e7490;
  background: #ecfeff;
}
.tag-ext {
  color: #b45309;
  background: #fffbeb;
}

.pu-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 12px;
  margin-bottom: 10px;
  border: 1.5px dashed var(--line-strong, #d6dfec);
  border-radius: var(--r-md);
  font-size: 12.5px;
  color: var(--ink-400);
  background: var(--bg);
}

.pu-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pu-count {
  font-size: 12px;
  color: var(--ink-400);
}
.pu-url {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.pu-error {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--red-500);
}
.pu-tip {
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink-400);
}
.pu-tip strong {
  color: var(--ink-600);
}
</style>
