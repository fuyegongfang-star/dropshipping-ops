<template>
  <div class="suppliers">
    <PageHeader
      title="供应商代发"
      subtitle="§21 一件代发履约链路：平台收单 → 推供应商 → 供应商发货 → 回传物流单号 → 平台转自有运单/轨迹"
      icon="supplier"
      accent="brand"
    >
      <template #actions>
        <el-button type="primary" @click="openNewSupplier">
          <AppIcon name="plus" :size="15" /> 新建供应商
        </el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="tab" class="sup-tabs">
      <!-- 供应商档案 -->
      <el-tab-pane label="供应商档案" name="suppliers">
        <el-row :gutter="16" class="stat-row">
          <el-col :span="8">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-ico ico-brand"><AppIcon name="supplier" :size="20" /></div>
              <div class="stat-label">供应商数量</div>
              <div class="stat-value">{{ suppliers.length }}</div>
              <div class="stat-sub">当前租户合作供货商</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-ico ico-info"><AppIcon name="package" :size="20" /></div>
              <div class="stat-label">代发单总数</div>
              <div class="stat-value">{{ orders.length }}</div>
              <div class="stat-sub">含进行中与已完成</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-ico ico-done"><AppIcon name="check" :size="20" /></div>
              <div class="stat-label">已完成代发</div>
              <div class="stat-value">{{ doneCount }}</div>
              <div class="stat-sub">终态 done 的代发单</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card v-loading="loadingSuppliers" class="list-card" shadow="never">
          <div class="toolbar">
            <div class="filters">
              <el-input v-model="supKeyword" placeholder="搜索供应商名称" clearable class="f-sel" @input="refreshSuppliers" />
            </div>
            <el-button text @click="refreshSuppliers"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
          </div>
          <el-table :data="supplierRows" class="sup-table" empty-text="暂无供应商" row-key="id">
            <el-table-column label="供应商 ID" prop="id" min-width="160">
              <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
            </el-table-column>
            <el-table-column label="供应商名称" prop="name" min-width="200" />
            <el-table-column label="建档时间" min-width="170">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="关联代发单" min-width="110">
              <template #default="{ row }">{{ orderCountOf(row.id) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 代发单 -->
      <el-tab-pane label="代发单" name="orders">
        <el-row :gutter="16" class="stat-row">
          <el-col v-for="s in STATUS_LIST" :key="s" :span="6">
            <el-card class="stat-card" shadow="hover">
              <div class="stat-ico" :class="statusIco(s)"><AppIcon name="swap" :size="20" /></div>
              <div class="stat-label">{{ SUPPLIER_ORDER_STATUS_LABELS[s] }}</div>
              <div class="stat-value">{{ countOf(s) }}</div>
              <div class="stat-sub">状态：{{ s }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-card v-loading="loadingOrders" class="list-card" shadow="never">
          <div class="toolbar">
            <el-button type="primary" @click="openNewOrder"><AppIcon name="plus" :size="15" /> 新建代发单</el-button>
            <el-button text @click="refreshOrders"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
          </div>
          <el-table :data="orders" class="order-table" empty-text="暂无代发单" row-key="id">
            <el-table-column label="代发单号" prop="id" min-width="160">
              <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
            </el-table-column>
            <el-table-column label="供应商" min-width="200">
              <template #default="{ row }">{{ supplierName(row.supplierId) }}</template>
            </el-table-column>
            <el-table-column label="关联订单" min-width="140">
              <template #default="{ row }"><span class="mono">{{ row.orderId || '—' }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="supplierStatusType(row.status)" size="small" effect="light">{{ supplierOrderLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" min-width="140" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status !== 'done'"
                  type="primary"
                  link
                  :loading="advancingId === row.id"
                  @click="advance(row)"
                >推进至 {{ nextLabel(row.status) }}</el-button>
                <el-tag v-else type="success" size="small" effect="plain">已终态</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建供应商 -->
    <el-dialog v-model="supVisible" title="新建供应商档案" width="440px">
      <el-form label-width="88px">
        <el-form-item label="供应商名称" required>
          <el-input v-model="supForm.name" placeholder="如：深圳华强北数码供货商" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="supVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmNewSupplier">提交</el-button>
      </template>
    </el-dialog>

    <!-- 新建代发单 -->
    <el-dialog v-model="orderVisible" title="新建代发单（推单）" width="460px">
      <el-form label-width="88px">
        <el-form-item label="选择供应商" required>
          <el-select v-model="orderForm.supplierId" placeholder="请选择供应商" class="full" :disabled="suppliers.length === 0">
            <el-option v-for="s in suppliers" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="关联订单">
          <el-input v-model="orderForm.orderId" placeholder="可选，平台订单号（如 ORD-1001）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="orderVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" :disabled="suppliers.length === 0" @click="confirmNewOrder">提交推单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  suppliersApi,
  type SupplierDto,
  type SupplierOrderDto,
  type SupplierOrderStatus,
  SUPPLIER_ORDER_STATUS_LABELS,
  SUPPLIER_ORDER_STATUS_TYPE,
  SUPPLIER_ORDER_FLOW,
} from '@/api/suppliers'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 供应商代发页（任务 1.9，方案 §21）：供应商档案 + 代发单（推单）创建与状态推进；演示/正式双路通。

const STATUS_LIST: SupplierOrderStatus[] = ['pushed', 'accepted', 'shipped', 'done']

const tab = ref('suppliers')
const suppliers = ref<SupplierDto[]>([])
const orders = ref<SupplierOrderDto[]>([])
const loadingSuppliers = ref(false)
const loadingOrders = ref(false)
const supKeyword = ref('')
const saving = ref(false)
const advancingId = ref('')
const supVisible = ref(false)
const orderVisible = ref(false)
const supForm = reactive({ name: '' })
const orderForm = reactive({ supplierId: '', orderId: '' })

const doneCount = computed(() => orders.value.filter((o) => o.status === 'done').length)

function countOf(s: SupplierOrderStatus): number {
  return orders.value.filter((o) => o.status === s).length
}
function orderCountOf(supplierId: string): number {
  return orders.value.filter((o) => o.supplierId === supplierId).length
}
function supplierName(supplierId: string): string {
  return suppliers.value.find((s) => s.id === supplierId)?.name ?? supplierId
}
function supplierStatusType(s: SupplierOrderStatus): string {
  return SUPPLIER_ORDER_STATUS_TYPE[s]
}
function supplierOrderLabel(s: SupplierOrderStatus): string {
  return SUPPLIER_ORDER_STATUS_LABELS[s]
}
function statusIco(_s: SupplierOrderStatus): string {
  return 'ico-brand'
}
function nextStatus(s: SupplierOrderStatus): SupplierOrderStatus | null {
  const idx = SUPPLIER_ORDER_FLOW.indexOf(s)
  return idx >= 0 && idx < SUPPLIER_ORDER_FLOW.length - 1 ? SUPPLIER_ORDER_FLOW[idx + 1] : null
}
function nextLabel(s: SupplierOrderStatus): string {
  const n = nextStatus(s)
  return n ? SUPPLIER_ORDER_STATUS_LABELS[n] : ''
}

const supplierRows = computed(() => {
  const k = supKeyword.value.trim().toLowerCase()
  if (!k) return suppliers.value
  return suppliers.value.filter((s) => s.name.toLowerCase().includes(k))
})

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function refreshSuppliers() {
  loadingSuppliers.value = true
  try {
    suppliers.value = await suppliersApi.listSuppliers()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载供应商失败')
  } finally {
    loadingSuppliers.value = false
  }
}

async function refreshOrders() {
  loadingOrders.value = true
  try {
    orders.value = await suppliersApi.listOrders()
  } catch (e) {
    ElMessage.error((e as Error).message || '加载代发单失败')
  } finally {
    loadingOrders.value = false
  }
}

function openNewSupplier() {
  supForm.name = ''
  supVisible.value = true
}
async function confirmNewSupplier() {
  if (!supForm.name.trim()) {
    ElMessage.warning('请输入供应商名称')
    return
  }
  saving.value = true
  try {
    await suppliersApi.createSupplier(supForm.name.trim())
    ElMessage.success('供应商已创建')
    supVisible.value = false
    await refreshSuppliers()
  } catch (e) {
    ElMessage.error((e as Error).message || '创建失败')
  } finally {
    saving.value = false
  }
}

function openNewOrder() {
  orderForm.supplierId = suppliers.value[0]?.id ?? ''
  orderForm.orderId = ''
  orderVisible.value = true
}
async function confirmNewOrder() {
  if (!orderForm.supplierId) {
    ElMessage.warning('请选择供应商')
    return
  }
  saving.value = true
  try {
    await suppliersApi.createOrder(orderForm.supplierId, orderForm.orderId || undefined)
    ElMessage.success('代发单已推送（pushed）')
    orderVisible.value = false
    await refreshOrders()
  } catch (e) {
    ElMessage.error((e as Error).message || '推单失败')
  } finally {
    saving.value = false
  }
}

async function advance(row: SupplierOrderDto) {
  const to = nextStatus(row.status)
  if (!to) return
  advancingId.value = row.id
  try {
    await suppliersApi.advance(row.id, to)
    ElMessage.success(`已推进至「${SUPPLIER_ORDER_STATUS_LABELS[to]}」`)
    await refreshOrders()
  } catch (e) {
    ElMessage.error((e as Error).message || '推进失败')
  } finally {
    advancingId.value = ''
  }
}

onMounted(() => {
  refreshSuppliers()
  refreshOrders()
})
</script>

<style scoped>
.suppliers {
  padding: 4px;
}
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: 16px;
}
.stat-ico {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}
.ico-brand {
  background: rgba(79, 110, 247, 0.12);
  color: var(--brand-500, #4f6ef7);
}
.ico-info {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
}
.ico-done {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}
.stat-label {
  font-size: 13px;
  color: var(--text-muted, #8a94a6);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin: 2px 0;
}
.stat-sub {
  font-size: 12px;
  color: var(--text-muted, #aab2c0);
}
.list-card {
  border-radius: 16px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.f-sel {
  width: 240px;
}
.full {
  width: 100%;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
