<template>
  <div class="ops-products">
    <div class="tip">
      <AppIcon name="box" :size="16" class="tip-ico" />
      <div class="tip-body">
        <strong>物流产品 / 费率卡说明</strong>
        <p>
          货代卖的是「产品」而非裸承运商：每个产品绑定承运商、物流段、目的区与时效，并挂一张
          <b>费率卡</b>（首重价 + 续重价）。成本 =
          <b>首重价 + 续重价 × max(0, 计费重kg − 1)</b>。点「试算」可即时核算任意计费重下的承运商成本。
        </p>
      </div>
    </div>

    <el-card>
      <template #header>
        <div class="card-head">
          <span class="section-title">物流产品目录</span>
          <div class="head-actions">
            <span class="count-pill">共 {{ products.length }} 个 · 启用 {{ enabledCount }}</span>
            <el-button type="primary" @click="openCreate">
              <AppIcon name="plus" :size="15" class="btn-ico" />新增产品
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="products">
        <el-table-column label="产品名" min-width="150">
          <template #default="{ row }"
            ><span class="strong">{{ row.name }}</span>
            <el-tag v-if="row.isDefault" size="small" type="warning" effect="plain" class="ml">默认</el-tag></template
          >
        </el-table-column>
        <el-table-column label="承运商" width="110">
          <template #default="{ row }"
            ><span class="tag-soft" :class="carrierClass(row.carrierCode)">{{
              carrierLabel(row.carrierCode)
            }}</span></template
          >
        </el-table-column>
        <el-table-column label="物流段" width="78" align="center">
          <template #default="{ row }"
            ><span class="muted">{{ legLabel(row.legType) }}</span></template
          >
        </el-table-column>
        <el-table-column label="目的区" width="86" align="center">
          <template #default="{ row }"
            ><span class="muted">{{ row.destZone }}</span></template
          >
        </el-table-column>
        <el-table-column label="时效" width="96" align="center">
          <template #default="{ row }"
            ><span class="muted">{{ row.transitDaysMin }}-{{ row.transitDaysMax }}天</span></template
          >
        </el-table-column>
        <el-table-column label="费率卡（元）" min-width="150">
          <template #default="{ row }">
            <span class="rate">首重 {{ row.firstWeightPrice }}</span>
            <span class="muted"> / 续重 {{ row.additionalWeightPrice }}/kg</span>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="72" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="onToggle(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" align="center">
          <template #default="{ row }">
            <el-tooltip content="费率卡试算" placement="top">
              <el-button link type="primary" class="act-btn" @click="openRate(row)">
                <AppIcon name="calculator" :size="15" />
              </el-button>
            </el-tooltip>
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

    <!-- 新增 / 编辑产品 -->
    <el-dialog
      v-model="dialog.visible"
      :title="dialog.editing ? '编辑物流产品' : '新增物流产品'"
      width="560px"
    >
      <el-form label-position="top">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="承运商" required>
              <el-select v-model="dialog.form.carrierCode" class="w-full">
                <el-option
                  v-for="(label, code) in CARRIER_LABELS"
                  :key="code"
                  :label="label"
                  :value="code"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品名" required>
              <el-input v-model="dialog.form.name" placeholder="如：云途-标准专线" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="物流段">
              <el-select v-model="dialog.form.legType" class="w-full">
                <el-option v-for="(label, code) in LEG_LABELS" :key="code" :label="label" :value="code" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="目的区">
              <el-input v-model="dialog.form.destZone" placeholder="ZONE_1..5 或 ALL" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="货物类型">
              <el-select v-model="dialog.form.cargoTypeAllowed" class="w-full">
                <el-option v-for="(label, code) in CARGO_LABELS" :key="code" :label="label" :value="code" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="时效下限(天)">
              <el-input-number v-model="dialog.form.transitDaysMin" class="w-full" :min="1" :max="60" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="时效上限(天)">
              <el-input-number v-model="dialog.form.transitDaysMax" class="w-full" :min="1" :max="60" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="抛比系数">
              <el-input-number v-model="dialog.form.volumetricDivisor" class="w-full" :min="1000" :max="8000" :step="500" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="首重价">
              <el-input-number v-model="dialog.form.firstWeightPrice" class="w-full" :min="0" :step="1" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="续重价/kg">
              <el-input-number v-model="dialog.form.additionalWeightPrice" class="w-full" :min="0" :step="1" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="费率卡币种">
              <el-select v-model="dialog.form.currency" class="w-full">
                <el-option label="CNY" value="CNY" />
                <el-option label="USD" value="USD" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="可达国家(ISO2，逗号分隔，空=不限)">
          <el-input v-model="dialog.form.reachableCountries" placeholder="如 US,GB,DE" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="启用"><el-switch v-model="dialog.form.enabled" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="默认产品"><el-switch v-model="dialog.form.isDefault" /></el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商户可见"><el-switch v-model="dialog.form.visible" /></el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">{{ dialog.editing ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 费率卡试算 -->
    <el-dialog v-model="rateDialog.visible" title="费率卡成本试算" width="420px">
      <div class="rate-prod">
        <span class="tag-soft" :class="carrierClass(rateDialog.product?.carrierCode ?? '')">{{
          carrierLabel(rateDialog.product?.carrierCode)
        }}</span>
        <strong>{{ rateDialog.product?.name }}</strong>
      </div>
      <el-form label-position="top" class="rate-form">
        <el-form-item label="计费重 (kg)">
          <el-input-number v-model="rateDialog.weightKg" class="w-full" :min="0" :step="0.1" />
        </el-form-item>
        <el-button type="primary" :loading="rateLoading" @click="runRate">核算成本</el-button>
      </el-form>
      <div v-if="rateDialog.rate" class="rate-result">
        <div class="rr-row">
          <span>计费重</span><b>{{ rateDialog.rate?.weightKg }} kg</b>
        </div>
        <div class="rr-row">
          <span>承运商成本</span><b class="rr-cost">{{ rateDialog.rate?.carrierCost }} {{ rateDialog.rate?.currency }}</b>
        </div>
        <div class="rr-row">
          <span>参考时效</span><b>{{ rateDialog.rate?.transitDays }}</b>
        </div>
        <p class="rr-hint">成本 = 首重价 + 续重价 × max(0, 计费重 − 1)</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  productsApi,
  CARRIER_LABELS,
  LEG_LABELS,
  CARGO_LABELS,
  type LogisticsProduct,
  type CarrierCode,
  type LegType,
  type RateCardQuote,
} from '@/api/pricing'
import AppIcon from '@/components/AppIcon.vue'

// 物流产品目录 / 费率卡（任务 4.6，方案 §4 / §23 运营配置后台）。
// 运营侧维护合约价产品：CRUD + 费率卡成本试算；演示与正式双路通。
const products = ref<LogisticsProduct[]>([])
const loading = ref(false)
const saving = ref(false)

const enabledCount = computed(() => products.value.filter((p) => p.enabled).length)

function carrierClass(code: string): string {
  const map: Record<string, string> = {
    yunexpress: 'tag-brand',
    dhl: 'tag-teal',
    '4px': 'tag-orange',
    yanwen: 'tag-violet',
  }
  return map[code] ?? 'tag-gray'
}

/** 承运商中文标签（表格行 carrierCode 为 any，需安全索引标签表）。 */
function carrierLabel(code: unknown): string {
  const c = (code ?? '') as CarrierCode
  return CARRIER_LABELS[c] ?? String(code ?? '')
}
/** 物流段中文标签。 */
function legLabel(code: unknown): string {
  const c = (code ?? '') as LegType
  return LEG_LABELS[c] ?? String(code ?? '')
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    products.value = await productsApi.list()
  } catch (e) {
    ElMessage.error('加载物流产品失败：' + errMsg(e))
  } finally {
    loading.value = false
  }
}

async function onToggle(row: LogisticsProduct): Promise<void> {
  try {
    await productsApi.update(row.id, { enabled: row.enabled })
    ElMessage.info(`「${row.name}」已${row.enabled ? '启用' : '停用'}`)
  } catch (e) {
    ElMessage.error('更新失败：' + errMsg(e))
    await load()
  }
}

// ===== 新增 / 编辑 =====
const dialog = reactive({
  visible: false,
  editing: false,
  editingId: '',
  form: blankForm(),
})

function blankForm(): Partial<LogisticsProduct> {
  return {
    carrierCode: 'yunexpress',
    name: '',
    legType: 'direct',
    destZone: 'ALL',
    cargoTypeAllowed: 'normal',
    transitDaysMin: 5,
    transitDaysMax: 9,
    volumetricDivisor: 5000,
    firstWeightPrice: 0,
    additionalWeightPrice: 0,
    currency: 'CNY',
    enabled: true,
    isDefault: false,
    visible: true,
  }
}

function openCreate(): void {
  dialog.editing = false
  dialog.editingId = ''
  dialog.form = blankForm()
  dialog.visible = true
}

function openEdit(row: LogisticsProduct): void {
  dialog.editing = true
  dialog.editingId = row.id
  dialog.form = { ...row }
  dialog.visible = true
}

async function submit(): Promise<void> {
  const f = dialog.form
  if (!f.carrierCode || !String(f.name ?? '').trim()) {
    ElMessage.warning('承运商与产品名必填')
    return
  }
  saving.value = true
  try {
    if (dialog.editing) {
      await productsApi.update(dialog.editingId, {
        carrierCode: f.carrierCode as CarrierCode,
        name: f.name,
        legType: f.legType,
        destZone: f.destZone,
        cargoTypeAllowed: f.cargoTypeAllowed,
        transitDaysMin: f.transitDaysMin,
        transitDaysMax: f.transitDaysMax,
        volumetricDivisor: f.volumetricDivisor,
        firstWeightPrice: f.firstWeightPrice,
        additionalWeightPrice: f.additionalWeightPrice,
        currency: f.currency,
        enabled: f.enabled,
        isDefault: f.isDefault,
        visible: f.visible,
      })
      ElMessage.success('产品已保存')
    } else {
      await productsApi.create({
        carrierCode: f.carrierCode as CarrierCode,
        name: f.name as string,
        legType: f.legType as LogisticsProduct['legType'],
        destZone: f.destZone,
        cargoTypeAllowed: f.cargoTypeAllowed as LogisticsProduct['cargoTypeAllowed'],
        transitDaysMin: f.transitDaysMin,
        transitDaysMax: f.transitDaysMax,
        volumetricDivisor: f.volumetricDivisor,
        firstWeightPrice: f.firstWeightPrice,
        additionalWeightPrice: f.additionalWeightPrice,
        currency: f.currency,
        enabled: f.enabled,
        isDefault: f.isDefault,
        visible: f.visible,
      })
      ElMessage.success('产品已新增')
    }
    dialog.visible = false
    await load()
  } catch (e) {
    ElMessage.error('保存失败：' + errMsg(e))
  } finally {
    saving.value = false
  }
}

async function confirmRemove(row: LogisticsProduct): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除物流产品「${row.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await productsApi.remove(row.id)
    ElMessage.success('已删除')
    await load()
  } catch (e) {
    ElMessage.error('删除失败：' + errMsg(e))
  }
}

// ===== 费率卡试算 =====
const rateDialog = reactive<{ visible: boolean; product: LogisticsProduct | null; weightKg: number; rate: RateCardQuote | null }>({
  visible: false,
  product: null,
  weightKg: 2.5,
  rate: null,
})
const rateLoading = ref(false)

function openRate(row: LogisticsProduct): void {
  rateDialog.product = row
  rateDialog.weightKg = 2.5
  rateDialog.rate = null
  rateDialog.visible = true
}

async function runRate(): Promise<void> {
  if (!rateDialog.product) return
  rateLoading.value = true
  try {
    rateDialog.rate = await productsApi.rate(rateDialog.product.id, rateDialog.weightKg)
  } catch (e) {
    ElMessage.error('试算失败：' + errMsg(e))
  } finally {
    rateLoading.value = false
  }
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
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-title {
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
.strong {
  font-weight: 600;
  color: var(--ink-800);
}
.ml {
  margin-left: 6px;
}
.muted {
  color: var(--ink-500);
}
.rate {
  font-weight: 700;
  color: var(--ink-900);
}
.act-btn {
  padding: 2px 4px;
}
.tag-soft {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 600;
}
.tag-brand {
  background: var(--brand-soft);
  color: var(--brand-700);
}
.tag-violet {
  background: var(--violet-soft);
  color: #7c3aed;
}
.tag-teal {
  background: #d6f5ee;
  color: #0f9b8e;
}
.tag-orange {
  background: #fde9d6;
  color: #c2610f;
}
.tag-gray {
  background: var(--line-soft);
  color: var(--ink-600);
}
.rate-prod {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.rate-form {
  margin-top: 4px;
}
.rate-result {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: #fff;
  border: 1px solid var(--line);
}
.rr-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  color: var(--ink-600);
}
.rr-row b {
  color: var(--ink-900);
}
.rr-cost {
  color: var(--brand-600);
}
.rr-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--ink-400);
}
.w-full {
  width: 100%;
}
</style>
