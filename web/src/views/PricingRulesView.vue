<template>
  <div class="pricing">
    <PageHeader
      title="运营配置 · 加价 / 币种"
      subtitle="平台加价规则引擎与币种归一 · 决定客户看到的最终售价（可自定义增删改）"
      icon="sliders"
      accent="violet"
    >
      <template #actions>
        <el-button type="primary" @click="openCreate">
          <AppIcon name="plus" :size="15" class="btn-ico" />新增规则
        </el-button>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
        <el-button link type="info" @click="resetDemo">重置演示数据</el-button>
      </template>
    </PageHeader>

    <div class="tip">
      <AppIcon name="coins" :size="16" class="tip-ico" />
      <div class="tip-body">
        <strong>加价规则说明（全部可自行调整）</strong>
        <p>
          规则按 <b>作用域 + 优先级</b> 生效：承运商专属规则覆盖全局基础加价，品类规则可叠加（如带电
          +6%）。 最终售价 = 成本 × (1 +
          有效加价率)。<b>加价幅度可直接在表格里改</b>，改完去「运费试算」页立即看到新售价。
        </p>
      </div>
    </div>

    <!-- 生效效果即时预览 -->
    <div class="preview">
      <span class="pv-label"><AppIcon name="bolt" :size="14" />加价效果预览</span>
      <span class="pv-item"
        >全局基准 <b>{{ globalRate }}%</b></span
      >
      <AppIcon name="arrowRight" :size="14" class="pv-arrow" />
      <span class="pv-item"
        >成本 <b>$10.00</b> → 客户售价 <b class="pv-sell">${{ previewSell }}</b></span
      >
      <span class="pv-hint">（含最低毛利保护 ¥5）</span>
    </div>

    <el-tabs v-model="activeTab" class="ops-tabs">
      <el-tab-pane label="加价规则" name="markup">
        <el-card>
          <template #header>
            <div class="card-head">
              <span class="section-title">加价规则</span>
              <span class="count-pill">共 {{ rules.length }} 条 · 生效 {{ enabledCount }} 条</span>
            </div>
          </template>

          <el-table v-loading="loading" :data="rules">
            <el-table-column label="作用域" width="86">
              <template #default="{ row }">
                <span class="tag-soft" :class="scopeClass(row.scope)">{{
                  scopeLabels[row.scope]
                }}</span>
              </template>
            </el-table-column>
            <el-table-column label="目标" min-width="120">
              <template #default="{ row }"
                ><span class="strong">{{ row.target }}</span></template
              >
            </el-table-column>
            <el-table-column label="加价幅度（可改）" width="164">
              <template #default="{ row }">
                <div class="val-cell">
                  <el-input-number
                    v-model="row.value"
                    size="small"
                    class="val-input"
                    :min="0"
                    :max="row.mode === 'percent' ? 500 : 100000"
                    :step="row.mode === 'percent' ? 1 : 0.5"
                    :precision="row.mode === 'percent' ? 0 : 2"
                    controls-position="right"
                    @change="onValueChange(row)"
                  />
                  <span class="unit" :class="row.mode === 'fixed' ? 'unit-fixed' : ''">
                    {{ row.mode === 'percent' ? '%' : 'USD' }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="70" align="center">
              <template #default="{ row }"
                ><span class="muted">{{ row.priority }}</span></template
              >
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="onToggle(row)" />
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="140">
              <template #default="{ row }"
                ><span class="muted note">{{ row.note || '—' }}</span></template
              >
            </el-table-column>
            <el-table-column label="操作" width="72" align="center">
              <template #default="{ row }">
                <el-tooltip content="编辑" placement="top">
                  <el-button link type="primary" class="act-btn" @click="openEdit(row)">
                    <AppIcon name="edit" :size="15" />
                  </el-button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button link type="danger" class="act-btn" @click="confirmRemove(row)">
                    <AppIcon name="trash" :size="15" />
                  </el-button>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="物流产品 / 费率卡" name="products">
        <OperationsProducts />
      </el-tab-pane>

      <el-tab-pane label="币种与汇率" name="fx">
        <el-card>
          <template #header><span class="section-title">币种与汇率</span></template>

          <el-table v-loading="loading" :data="fx">
            <el-table-column label="币种对" min-width="150">
              <template #default="{ row }">
                <span class="pair">
                  <span class="tag-soft tag-gray">{{ row.base }}</span>
                  <AppIcon name="arrowRight" :size="13" class="pair-arrow" />
                  <span class="tag-soft tag-brand">{{ row.quote }}</span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="汇率" width="120" align="right">
              <template #default="{ row }"
                ><span class="rate">{{ row.rate }}</span></template
              >
            </el-table-column>
            <el-table-column label="更新时间" min-width="200">
              <template #default="{ row }"
                ><span class="muted upd">{{ fmt(row.updatedAt) }}</span></template
              >
            </el-table-column>
            <el-table-column label="操作" width="90" align="center">
              <template #default="{ row }">
                <el-button link type="primary" class="act-btn" @click="openFx(row)">
                  <AppIcon name="edit" :size="15" />
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <p class="text-hint fx-hint">
            汇率用于成本（CNY 结算）与客户售价（USD 展示）之间的归一换算；
            生产环境由定时任务刷新并落库快照。
          </p>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新增 / 编辑加价规则 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.editing ? '编辑加价规则' : '新增加价规则'"
      width="520px"
    >
      <el-form label-position="top">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="作用域">
              <el-select v-model="dialog.form.scope" class="w-full" @change="onScopeChange">
                <el-option
                  v-for="(label, key) in SCOPE_LABELS"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="目标">
              <el-select
                v-model="dialog.form.target"
                class="w-full"
                filterable
                allow-create
                default-first-option
                placeholder="选择或直接输入"
              >
                <el-option v-for="t in targetOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="加价方式">
          <el-radio-group v-model="dialog.form.mode">
            <el-radio-button value="percent">按比例 (%)</el-radio-button>
            <el-radio-button value="fixed">固定金额 (USD)</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item
              :label="dialog.form.mode === 'percent' ? '加价幅度 (%)' : '加价金额 (USD)'"
            >
              <el-input-number
                v-model="dialog.form.value"
                class="w-full"
                :min="0"
                :max="dialog.form.mode === 'percent' ? 500 : 100000"
                :step="dialog.form.mode === 'percent' ? 1 : 0.5"
                :precision="dialog.form.mode === 'percent' ? 0 : 2"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="优先级（数字大者优先）">
              <el-input-number v-model="dialog.form.priority" class="w-full" :min="0" :max="999" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="说明">
          <el-input
            v-model="dialog.form.note"
            type="textarea"
            :rows="2"
            placeholder="例如：大客户专属低加价"
          />
        </el-form-item>

        <el-form-item label="启用">
          <el-switch v-model="dialog.form.enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitRule">
          {{ dialog.editing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑汇率 -->
    <el-dialog v-model="fxDialog.visible" title="调整汇率" width="380px">
      <div class="fx-edit">
        <span class="tag-soft tag-gray">{{ fxDialog.base }}</span>
        <AppIcon name="arrowRight" :size="14" class="pair-arrow" />
        <span class="tag-soft tag-brand">{{ fxDialog.quote }}</span>
      </div>
      <el-form label-position="top" class="fx-form">
        <el-form-item label="汇率">
          <el-input-number
            v-model="fxDialog.rate"
            class="w-full"
            :min="0.0001"
            :step="0.01"
            :precision="4"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fxDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitFx">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pricingApi, SCOPE_LABELS, type MarkupRule, type FxRate } from '@/api/pricing'
// 仅用于「重置演示数据」：清空 localStorage 中的演示定价快照（正式模式无副作用）。
import { resetPricingDemo } from '@/api/mock-data'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import OperationsProducts from '@/views/OperationsProducts.vue'

// 加价规则 / 币种配置页（阶段3.6 引擎成果 + 4.6 运营配置后台）。
// 本页为「运营配置后台」的可视化实现：加价幅度、作用域、优先级、启停、物流产品与费率卡均可自定义，
// 改动经 pricingApi 落库（演示模式下写入 mock 内存态，刷新后仍生效于本次会话）。
// 表格 slot 的 row 为 any，故将标签字典放宽索引类型为 string 以避免 TS7053。
const activeTab = ref<string>('markup')
const scopeLabels: Record<string, string> = SCOPE_LABELS
const rules = ref<MarkupRule[]>([])
const fx = ref<FxRate[]>([])
const loading = ref(false)
const saving = ref(false)

const enabledCount = computed(() => rules.value.filter((r) => r.enabled).length)

/** 全局基准加价率：用于顶部「加价效果预览」。 */
const globalRate = computed(() => {
  const g = rules.value.find((r) => r.scope === 'global' && r.enabled && r.mode === 'percent')
  return g ? g.value : 0
})

/** 成本 $10 的售价预览（含最低毛利保护 ¥5 ≈ $0.69）。 */
const previewSell = computed(() => {
  const cost = 10
  const raw = cost * (1 + globalRate.value / 100)
  const minMarginUsd = 5 / 7.242
  return Math.max(raw, cost + minMarginUsd).toFixed(2)
})

const dialog = reactive({
  visible: false,
  editing: false,
  editingId: '',
  form: blankForm(),
})

const fxDialog = reactive({ visible: false, base: '', quote: '', rate: 1 })

function blankForm(): MarkupRule {
  return {
    id: '',
    scope: 'global',
    target: '全部渠道',
    mode: 'percent',
    value: 10,
    priority: 50,
    enabled: true,
    note: '',
  }
}

/** 各作用域的候选目标（可自由输入，此处仅作快捷建议）。 */
const TARGET_OPTIONS: Record<string, string[]> = {
  global: ['全部渠道'],
  tenant: ['Acme 跨境店', 'Demo 演示租户'],
  carrier: ['云途物流', 'DHL 快递', '4PX 递四方', '燕文物流'],
  channel: ['Amazon US', 'Shopify', 'Mock 体验店'],
  product: ['带电类目', '敏感货', '普货'],
}
const targetOptions = computed(() => TARGET_OPTIONS[dialog.form.scope] ?? [])

function scopeClass(scope: string): string {
  const map: Record<string, string> = {
    global: 'tag-brand',
    tenant: 'tag-violet',
    carrier: 'tag-teal',
    channel: 'tag-orange',
    product: 'tag-amber',
  }
  return map[scope] ?? 'tag-gray'
}

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [r, f] = await Promise.all([pricingApi.markupRules(), pricingApi.fxRates()])
    rules.value = r
    fx.value = f
  } catch (e) {
    ElMessage.error('加载定价配置失败：' + errMsg(e))
  } finally {
    loading.value = false
  }
}

// ===== 行内/开关变更 =====
/** 表格内直接改加价幅度 → 立即落库。 */
async function onValueChange(row: MarkupRule): Promise<void> {
  try {
    await pricingApi.updateMarkupRule(row.id, { value: row.value })
    ElMessage.success(
      `「${row.target}」加价幅度已更新为 ${row.mode === 'percent' ? row.value + '%' : '$' + row.value.toFixed(2)}`,
    )
  } catch (e) {
    ElMessage.error('更新失败：' + errMsg(e))
    await load()
  }
}

async function onToggle(row: MarkupRule): Promise<void> {
  try {
    await pricingApi.updateMarkupRule(row.id, { enabled: row.enabled })
    ElMessage.info(`「${row.target}」已${row.enabled ? '启用' : '停用'}`)
  } catch (e) {
    ElMessage.error('更新失败：' + errMsg(e))
    await load()
  }
}

// ===== 新增 / 编辑 =====
function openCreate(): void {
  dialog.editing = false
  dialog.editingId = ''
  dialog.form = blankForm()
  dialog.visible = true
}

function openEdit(row: MarkupRule): void {
  dialog.editing = true
  dialog.editingId = row.id
  dialog.form = { ...row }
  dialog.visible = true
}

/** 切换作用域时，若当前目标不在候选内则回落到该作用域首个建议值。 */
function onScopeChange(): void {
  const opts = TARGET_OPTIONS[dialog.form.scope] ?? []
  if (opts.length && !opts.includes(dialog.form.target)) {
    dialog.form.target = opts[0]
  }
}

async function submitRule(): Promise<void> {
  const f = dialog.form
  if (!f.target || !String(f.target).trim()) {
    ElMessage.warning('请填写目标（渠道/承运商/租户/类目）')
    return
  }
  if (!(f.value >= 0)) {
    ElMessage.warning('加价幅度必须 ≥ 0')
    return
  }
  saving.value = true
  try {
    if (dialog.editing) {
      await pricingApi.updateMarkupRule(dialog.editingId, {
        scope: f.scope,
        target: f.target,
        mode: f.mode,
        value: f.value,
        priority: f.priority,
        enabled: f.enabled,
        note: f.note,
      })
      ElMessage.success('加价规则已保存')
    } else {
      await pricingApi.createMarkupRule({
        scope: f.scope,
        target: f.target,
        mode: f.mode,
        value: f.value,
        priority: f.priority,
        enabled: f.enabled,
        note: f.note,
      })
      ElMessage.success('加价规则已新增')
    }
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error('保存失败：' + errMsg(e))
  } finally {
    saving.value = false
  }
}

async function confirmRemove(row: MarkupRule): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除加价规则「${row.target}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await pricingApi.removeMarkupRule(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error('删除失败：' + errMsg(e))
  }
}

// ===== 汇率 =====
function openFx(row: FxRate): void {
  fxDialog.base = row.base
  fxDialog.quote = row.quote
  fxDialog.rate = row.rate
  fxDialog.visible = true
}

async function submitFx(): Promise<void> {
  saving.value = true
  try {
    await pricingApi.updateFxRate(fxDialog.base, fxDialog.quote, fxDialog.rate)
    ElMessage.success(`${fxDialog.base}/${fxDialog.quote} 汇率已更新`)
    fxDialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error('更新失败：' + errMsg(e))
  } finally {
    saving.value = false
  }
}

// ===== 演示数据重置 =====
/** 清空本地演示中的加价/汇率改动（仅影响演示模式的 localStorage 快照）。 */
async function resetDemo(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将清除本地演示中的加价规则与汇率改动，恢复初始数据？',
      '重置演示数据',
      {
        type: 'warning',
        confirmButtonText: '重置',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return // 用户取消
  }
  resetPricingDemo()
  ElMessage.success('已重置，正在重新加载…')
  setTimeout(() => location.reload(), 600)
}

onMounted(load)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
}
.tip {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 16px;
  margin-bottom: 14px;
  border-radius: var(--r-md);
  background: linear-gradient(90deg, var(--violet-soft), #faf7ff);
  border: 1px solid #e9e0ff;
}
.tip-ico {
  color: var(--violet-500);
  margin-top: 2px;
}
.tip-body {
  font-size: 13px;
  color: var(--ink-700);
  line-height: 1.7;
}
.tip-body strong {
  display: block;
  color: var(--ink-900);
  margin-bottom: 3px;
}
.tip-body p {
  margin: 0;
}
.tip-body b {
  color: #6d28d9;
}

.preview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: var(--r-md);
  background: #fff;
  border: 1px solid var(--line);
  font-size: 12.5px;
  color: var(--ink-600);
}
.pv-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: var(--brand-600);
}
.pv-item b {
  color: var(--ink-900);
}
.pv-sell {
  color: var(--brand-600);
}
.pv-arrow {
  color: var(--ink-300);
}
.pv-hint {
  color: var(--ink-400);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.fx-col {
  margin-top: 16px;
}
.card-head .section-title {
  margin: 0;
}
.count-pill {
  font-size: 12px;
  font-weight: 600;
  color: #6d28d9;
  background: var(--violet-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}

/** 加价幅度单元格：数字输入 + 单位后缀，宽度收窄以适配表格。 */
.val-cell {
  display: flex;
  align-items: center;
  gap: 5px;
}
.val-input {
  width: 108px;
}
.val-input :deep(.el-input__inner) {
  font-weight: 700;
  color: var(--brand-600);
}
.unit {
  font-size: 12px;
  font-weight: 700;
  color: var(--brand-600);
}
.unit-fixed {
  color: #b45309;
}

.strong {
  font-weight: 600;
  color: var(--ink-800);
}
.muted {
  color: var(--ink-500);
}
.note {
  font-size: 12.5px;
}
.act-btn {
  padding: 2px 4px;
}

.pair {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.pair-arrow {
  color: var(--ink-300);
}
.rate {
  font-weight: 700;
  color: var(--ink-900);
}
.upd {
  font-size: 12px;
}
.fx-hint {
  margin: 14px 0 0;
}
.fx-edit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 6px;
}
.fx-form {
  margin-top: 4px;
}
</style>
