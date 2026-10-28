<template>
  <div class="catalog">
    <PageHeader
      title="商品 / SKU 中心"
      subtitle="平台 ↔ 内部 ↔ 供应商 三段映射 · 计费重自动派生 · 条码建档"
      icon="catalog"
      accent="violet"
    >
      <template #actions>
        <el-button @click="reload">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
      </template>
    </PageHeader>

    <el-card>
      <el-tabs v-model="tab" class="tabs">
        <el-tab-pane name="products">
          <template #label>
            <span class="tab-label">
              <AppIcon name="layers" :size="15" />商品（SPU）
              <em>{{ products.length }}</em>
            </span>
          </template>
          <el-table v-loading="loadingP" :data="products">
            <el-table-column prop="title" label="标题" min-width="200">
              <template #default="{ row }"><span class="t-title">{{ row.title }}</span></template>
            </el-table-column>
            <el-table-column prop="spu" label="SPU" width="150">
              <template #default="{ row }"><span class="mono">{{ row.spu }}</span></template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="175">
              <template #default="{ row }"><span class="muted">{{ fmt(row.createdAt) }}</span></template>
            </el-table-column>
            <template #empty>
              <div class="app-empty">
                <span class="app-empty-ico"><AppIcon name="layers" :size="26" /></span>
                <span class="app-empty-text">暂无商品数据</span>
              </div>
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="skus">
          <template #label>
            <span class="tab-label">
              <AppIcon name="box" :size="15" />内部 SKU
              <em>{{ skus.length }}</em>
            </span>
          </template>

          <div class="toolbar">
            <el-button
              :type="scanMode === 'locate' ? 'primary' : 'default'"
              :class="{ scanning: scanMode === 'locate' }"
              @click="toggleLocate"
            >
              <AppIcon name="scan" :size="15" class="btn-ico" />
              {{ scanMode === 'locate' ? '扫码定位中…（扫一下条码）' : '扫码定位' }}
            </el-button>
            <el-button v-if="filterSkuId" size="small" text @click="clearLocate">
              <AppIcon name="close" :size="14" class="btn-ico" />清除定位
            </el-button>
            <span v-if="scanMode === 'locate'" class="hint">
              <AppIcon name="info" :size="14" class="hint-ico" />瞄一眼：用扫码枪扫商品条码，自动定位到对应 SKU
            </span>
          </div>

          <el-table v-loading="loadingS" :data="visibleSkus">
            <el-table-column prop="code" label="内部SKU" width="160">
              <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="platformSku" label="平台SKU" width="150">
              <template #default="{ row }"><span class="muted">{{ row.platformSku }}</span></template>
            </el-table-column>
            <el-table-column prop="supplierSku" label="供应商SKU" width="150">
              <template #default="{ row }"><span class="muted">{{ row.supplierSku }}</span></template>
            </el-table-column>
            <el-table-column label="实重(g)" width="95" prop="weightG" />
            <el-table-column label="体积重(g)" width="105">
              <template #default="{ row }"><span class="muted">{{ volWeight(row) }}</span></template>
            </el-table-column>
            <el-table-column label="计费重(g)" width="110">
              <template #default="{ row }">
                <span class="weight-pill">{{ billable(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="尺寸(cm)" min-width="130">
              <template #default="{ row }"><span class="muted">{{ dims(row) }}</span></template>
            </el-table-column>
            <el-table-column label="商品条码" min-width="160">
              <template #default="{ row }">
                <span v-if="row.barcode" class="mono barcode">{{ row.barcode }}</span>
                <span v-else class="muted">—</span>
                <el-tag
                  v-if="barcodeCounts[row.id] > 0"
                  size="small"
                  type="info"
                  effect="plain"
                  class="multi-badge"
                >+{{ barcodeCounts[row.id] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="openEdit(row)">
                  <AppIcon name="edit" :size="14" class="btn-ico" />条码
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <div class="app-empty">
                <span class="app-empty-ico"><AppIcon name="box" :size="26" /></span>
                <span class="app-empty-text">暂无 SKU 数据</span>
              </div>
            </template>
          </el-table>

          <div class="formula">
            <AppIcon name="warning" :size="15" class="f-ico" />
            <span>
              计费重 = max(实重, 体积重)，体积重 = 长×宽×高 / 抛比系数(5000)。
              主条码（Sku.barcode）供扫码枪反查；点「条码」可录入主码、连扫多码、设为主码。
            </span>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- SKU 条码编辑弹窗（阶段7，任务 7.1） -->
    <el-dialog v-model="dialogVisible" title="SKU 条码建档" width="640px" @closed="onDialogClosed">
      <el-form v-if="editing" label-width="92px" class="sku-form">
        <el-form-item label="内部SKU">
          <span class="mono">{{ editing.code }}</span>
        </el-form-item>

        <el-form-item label="商品条码">
          <div class="barcode-row">
            <el-input
              v-model="editing.barcode"
              placeholder="主条码（EAN-13 / UPC-A / 自定义），可手动输入或点右侧扫一下"
              clearable
              class="barcode-input"
            />
            <el-button
              :type="scanMode === 'barcode' ? 'primary' : 'default'"
              :class="{ scanning: scanMode === 'barcode' }"
              @click="startScanBarcode"
            >
              <AppIcon name="scan" :size="15" class="btn-ico" />{{ scanMode === 'barcode' ? '扫描中…' : '扫一下' }}
            </el-button>
          </div>
          <div v-if="barcodeWarning" class="barcode-warn">
            <AppIcon name="warning" :size="14" class="w-ico" />{{ barcodeWarning }}
          </div>
        </el-form-item>

        <el-divider content-position="left">多码管理</el-divider>

        <div class="batch-bar">
          <el-button
            :type="scanMode === 'batch' ? 'primary' : 'default'"
            :class="{ scanning: scanMode === 'batch' }"
            @click="toggleBatch"
          >
            <AppIcon name="scan" :size="15" class="btn-ico" />
            {{ scanMode === 'batch' ? '连扫中…（逐条写入）' : '批量扫码建档' }}
          </el-button>
          <span v-if="scanMode === 'batch'" class="hint">
            <AppIcon name="info" :size="14" class="hint-ico" />连续扫多个条码即可逐条写入；结束后点「结束连扫」
          </span>
        </div>

        <el-table :data="barcodes" size="small" class="barcode-table" empty-text="暂无多码，点击「批量扫码建档」连扫写入">
          <el-table-column prop="code" label="条码" min-width="180">
            <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
          </el-table-column>
          <el-table-column label="类型" width="120">
            <template #default="{ row }"><el-tag size="small" effect="plain">{{ kindLabel(row.kind) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="操作" width="170">
            <template #default="{ row }">
              <el-button size="small" text type="primary" :disabled="row.code === editing.barcode" @click="setMain(row)">设为主码</el-button>
              <el-button size="small" text type="danger" @click="removeBarcode(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="saving" @click="saveSku">保存主码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { catalogApi, type Product, type Sku, type SkuBarcode } from '@/api/catalog'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useScannerInput } from '@/composables/useScannerInput'

const tab = ref('products')
const products = ref<Product[]>([])
const skus = ref<Sku[]>([])
const loadingP = ref(false)
const loadingS = ref(false)

// 多码数量（按 SKU 聚合），用于列表「+N」徽章
const barcodesAll = ref<SkuBarcode[]>([])
const barcodeCounts = computed<Record<string, number>>(() => {
  const m: Record<string, number> = {}
  for (const b of barcodesAll.value) m[b.skuId] = (m[b.skuId] ?? 0) + 1
  return m
})

// 扫码定位过滤
const filterSkuId = ref<string | null>(null)
const visibleSkus = computed(() =>
  filterSkuId.value ? skus.value.filter((s) => s.id === filterSkuId.value) : skus.value,
)

// 弹窗编辑态
const dialogVisible = ref(false)
const editing = ref<Sku | null>(null)
const barcodes = ref<SkuBarcode[]>([])
const saving = ref(false)

// 扫码模式（单实例复用）：idle / locate / barcode / batch
const scanMode = ref<'idle' | 'locate' | 'barcode' | 'batch'>('idle')

/** 统一扫码回调：按当前模式路由到不同业务；active 守卫仅在非 idle 时监听钩子 */
useScannerInput({
  active: () => scanMode.value !== 'idle',
  onScan: (value: string) => {
    if (scanMode.value === 'locate') onLocateScan(value)
    else if (scanMode.value === 'barcode') onBarcodeScan(value)
    else if (scanMode.value === 'batch') onBatchScan(value)
  },
})

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function dims(row: Sku): string {
  return [row.lengthCm, row.widthCm, row.heightCm].filter((v) => v != null).join(' × ') || '-'
}
function volWeight(row: Sku): number | string {
  if (row.lengthCm == null || row.widthCm == null || row.heightCm == null) return '-'
  return Math.round(((row.lengthCm * row.widthCm * row.heightCm) / 5000) * 1000)
}
function billable(row: Sku): number {
  const v = volWeight(row)
  return Math.max(row.weightG, typeof v === 'number' ? v : 0)
}

// —— 本地 EAN-13 / UPC-A 校验位提示（演示态与后端同口径，仅提示不拦截）——
function computeBarcodeWarning(code?: string | null): string {
  if (!code) return ''
  const digits = code.replace(/\D/g, '')
  if (digits.length === 13) return checkWarn(digits, [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3], 'EAN-13')
  if (digits.length === 12) return checkWarn(digits, [3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3], 'UPC-A')
  return ''
}
function checkWarn(digits: string, weights: number[], std: string): string {
  let sum = 0
  for (let i = 0; i < digits.length - 1; i++) sum += Number(digits[i]) * weights[i]
  const expected = String((10 - (sum % 10)) % 10)
  if (expected !== digits[digits.length - 1]) return `${std} 校验位不符，应为 ${expected}（仅提示，已正常保存）`
  return ''
}
const barcodeWarning = computed(() => computeBarcodeWarning(editing.value?.barcode))

function kindLabel(kind: string): string {
  return (
    { supplier: '供应商码', internal: '内部码', ean13: 'EAN-13', other: '其它' } as Record<string, string>
  )[kind] ?? '其它'
}

// ===== 加载 =====
async function loadProducts(): Promise<void> {
  loadingP.value = true
  try {
    products.value = await catalogApi.products()
  } finally {
    loadingP.value = false
  }
}
async function loadSkus(): Promise<void> {
  loadingS.value = true
  try {
    skus.value = await catalogApi.skus()
    barcodesAll.value = []
    // 聚合全部 SKU 的多码用于徽章（演示/正式双路）
    await Promise.all(
      skus.value.map(async (s) => {
        try {
          const list = await catalogApi.listBarcodes(s.id)
          barcodesAll.value.push(...list)
        } catch {
          /* 单条失败不影响整体 */
        }
      }),
    )
  } finally {
    loadingS.value = false
  }
}
function reload(): void {
  loadProducts()
  loadSkus()
}

// ===== 扫码定位 =====
function toggleLocate(): void {
  scanMode.value = scanMode.value === 'locate' ? 'idle' : 'locate'
}
function clearLocate(): void {
  filterSkuId.value = null
}
async function onLocateScan(value: string): Promise<void> {
  scanMode.value = 'idle'
  try {
    const res = await catalogApi.barcodeLookup(value)
    if (res) {
      filterSkuId.value = res.skuId
      ElMessage.success(`已定位到 SKU（${res.matchedBy === 'main' ? '主码命中' : '多码命中'}）`)
    } else {
      ElMessage.warning(`条码 ${value} 未建档`)
    }
  } catch {
    ElMessage.warning('扫码定位失败，请重试')
  }
}

// ===== 编辑弹窗 =====
async function openEdit(row: Sku): Promise<void> {
  editing.value = { ...row }
  dialogVisible.value = true
  await loadDialogBarcodes(row.id)
}
function onDialogClosed(): void {
  scanMode.value = 'idle'
  editing.value = null
}
async function loadDialogBarcodes(skuId: string): Promise<void> {
  try {
    barcodes.value = await catalogApi.listBarcodes(skuId)
  } catch {
    barcodes.value = []
  }
}

function startScanBarcode(): void {
  scanMode.value = scanMode.value === 'barcode' ? 'idle' : 'barcode'
}
function onBarcodeScan(value: string): void {
  if (editing.value) editing.value.barcode = value
  scanMode.value = 'idle' // 单个条码扫完即退出，避免长时间占用扫码枪
}

function toggleBatch(): void {
  scanMode.value = scanMode.value === 'batch' ? 'idle' : 'batch'
}
async function onBatchScan(value: string): Promise<void> {
  if (!editing.value) return
  try {
    const created = await catalogApi.addBarcode(editing.value.id, value, 'other')
    barcodes.value.push(created)
    barcodesAll.value.push(created) // 同步徽章计数
    ElMessage.success(`已写入多码 ${value}`)
  } catch (e) {
    ElMessage.warning((e as Error).message || '写入失败（可能重复）')
  }
}

async function setMain(row: SkuBarcode): Promise<void> {
  if (!editing.value) return
  try {
    const updated = await catalogApi.setMainBarcode(editing.value.id, row.id)
    editing.value = { ...editing.value, barcode: updated.barcode ?? updated.barcode }
    editing.value.barcode = updated.barcode ?? null
    await loadDialogBarcodes(editing.value.id)
    // 刷新列表主码
    const idx = skus.value.findIndex((s) => s.id === editing.value!.id)
    if (idx >= 0) skus.value[idx] = { ...skus.value[idx], barcode: updated.barcode ?? null }
    ElMessage.success('已设为主码（原主码降级为多码）')
  } catch (e) {
    ElMessage.warning((e as Error).message || '设为主码失败')
  }
}
async function removeBarcode(row: SkuBarcode): Promise<void> {
  try {
    await catalogApi.deleteBarcode(row.id)
    barcodes.value = barcodes.value.filter((b) => b.id !== row.id)
    barcodesAll.value = barcodesAll.value.filter((b) => b.id !== row.id)
    ElMessage.success('已删除多码')
  } catch (e) {
    ElMessage.warning((e as Error).message || '删除失败')
  }
}

async function saveSku(): Promise<void> {
  if (!editing.value) return
  saving.value = true
  try {
    // 演示态不提供完整 SKU 更新接口，这里仅回写主码到列表（真实后端走 PATCH /catalog/skus/:id）
    const idx = skus.value.findIndex((s) => s.id === editing.value!.id)
    if (idx >= 0) {
      skus.value[idx] = {
        ...skus.value[idx],
        barcode: editing.value.barcode ?? null,
        barcodeCheckWarning: computeBarcodeWarning(editing.value.barcode),
      }
    }
    ElMessage.success('主码已保存')
    dialogVisible.value = false
  } finally {
    saving.value = false
  }
}

onMounted(reload)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
}
.tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tab-label em {
  font-style: normal;
  background: var(--violet-soft);
  color: #6d28d9;
  border-radius: var(--r-pill);
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
}
.t-title {
  font-weight: 500;
  color: var(--ink-800);
}
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12.5px;
}
.muted {
  color: var(--ink-500);
}
.barcode {
  color: var(--ink-800);
  background: var(--line-soft);
  padding: 1px 7px;
  border-radius: 6px;
}
.multi-badge {
  margin-left: 6px;
}
.weight-pill {
  display: inline-block;
  min-width: 52px;
  text-align: center;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--violet-soft);
  color: #6d28d9;
  font-weight: 700;
  font-size: 12.5px;
}
.formula {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--line-soft);
  border-radius: var(--r-md);
  color: var(--ink-500);
  font-size: 12.5px;
  line-height: 1.7;
}
.f-ico {
  color: var(--amber-500);
  margin-top: 2px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.hint {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--ink-500);
  font-size: 12.5px;
}
.hint-ico {
  color: var(--brand-500);
}
.scanning {
  animation: pulse 1.1s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(79, 110, 247, 0.4);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(79, 110, 247, 0);
  }
}
.barcode-row {
  display: flex;
  gap: 8px;
  width: 100%;
}
.barcode-input {
  flex: 1;
}
.barcode-warn {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 6px;
  color: var(--amber-600);
  font-size: 12.5px;
}
.w-ico {
  color: var(--amber-500);
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.barcode-table {
  margin-top: 4px;
}
.sku-form :deep(.el-divider__text) {
  color: var(--ink-500);
  font-size: 12.5px;
}
</style>
