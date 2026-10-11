<template>
  <div class="orders">
    <el-card>
      <template #header>
        <div class="head">
          <span>订单中心</span>
          <div class="filters">
            <el-select v-model="statusFilter" placeholder="全部状态" clearable @change="load">
              <el-option v-for="(label, val) in statusLabels" :key="val" :label="label" :value="val" />
            </el-select>
            <el-button @click="load">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="orders" stripe>
        <el-table-column prop="platformOrderNo" label="平台单号" min-width="160" />
        <el-table-column label="店铺" min-width="140">
          <template #default="{ row }">{{ row.shop?.name || row.shopId }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small">{{ statusLabels[row.status] || row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="120">
          <template #default="{ row }">
            {{ row.totalAmount != null ? Number(row.totalAmount).toFixed(2) : '-' }}
            {{ row.currency || '' }}
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawer" :title="`订单详情 · ${current?.platformOrderNo || ''}`" size="46%">
      <template v-if="current">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(current.status)" size="small">
              {{ statusLabels[current.status] || current.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="店铺">{{ current.shop?.name || current.shopId }}</el-descriptions-item>
          <el-descriptions-item label="金额">
            {{ current.totalAmount != null ? Number(current.totalAmount).toFixed(2) : '-' }} {{ current.currency }}
          </el-descriptions-item>
          <el-descriptions-item label="平台单号">{{ current.platformOrderNo }}</el-descriptions-item>
          <el-descriptions-item label="收件人" :span="2">
            {{ recipientText(current.recipient) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>订单明细</el-divider>
        <el-table :data="current.items || []" size="small" border>
          <el-table-column label="内部SKU">
            <template #default="{ row }">{{ row.sku?.code || '—' }}</template>
          </el-table-column>
          <el-table-column label="平台SKU">
            <template #default="{ row }">{{ row.sku?.platformSku || '—' }}</template>
          </el-table-column>
          <el-table-column label="供应商SKU">
            <template #default="{ row }">{{ row.sku?.supplierSku || '—' }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="70" />
        </el-table>

        <el-divider>状态流转轨迹</el-divider>
        <el-timeline>
          <el-timeline-item
            v-for="e in current.events || []"
            :key="e.id"
            :timestamp="fmt(e.createdAt)"
            placement="top"
          >
            <span>{{ e.type }}</span>
            <span v-if="e.operator" class="op">· {{ e.operator }}</span>
          </el-timeline-item>
        </el-timeline>

        <el-divider>操作</el-divider>
        <div class="actions">
          <el-button type="primary" @click="doReview">审单</el-button>
          <el-button type="success" @click="transitionVisible = true">状态转移</el-button>
          <el-button type="warning" @click="reverseVisible = true">逆向</el-button>
        </div>

        <!-- 状态转移 -->
        <el-dialog v-model="transitionVisible" title="状态转移" width="380">
          <el-form label-width="80">
            <el-form-item label="目标状态">
              <el-select v-model="transitionTo" placeholder="选择目标状态">
                <el-option
                  v-for="t in allowedNext"
                  :key="t"
                  :label="statusLabels[t] || t"
                  :value="t"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="transitionVisible = false">取消</el-button>
            <el-button type="primary" @click="doTransition">确认转移</el-button>
          </template>
        </el-dialog>

        <!-- 逆向 -->
        <el-dialog v-model="reverseVisible" title="发起逆向流程" width="420">
          <el-form label-width="80">
            <el-form-item label="类型">
              <el-select v-model="reverseType" placeholder="选择逆向类型">
                <el-option v-for="(label, val) in reverseTypes" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
            <el-form-item label="原因">
              <el-input v-model="reverseCause" type="textarea" :rows="2" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="reverseVisible = false">取消</el-button>
            <el-button type="warning" @click="doReverse">确认发起</el-button>
          </template>
        </el-dialog>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ordersApi,
  ORDER_STATUS_LABELS,
  ORDER_ALLOWED_TRANSITIONS,
  REVERSE_TYPES,
  type Order,
} from '@/api/orders'

const statusLabels = ORDER_STATUS_LABELS
const reverseTypes = REVERSE_TYPES

const orders = ref<Order[]>([])
const loading = ref(false)
const statusFilter = ref('')

const drawer = ref(false)
const current = ref<Order | null>(null)
const transitionVisible = ref(false)
const transitionTo = ref('')
const reverseVisible = ref(false)
const reverseType = ref('')
const reverseCause = ref('')

const allowedNext = computed(() =>
  current.value ? ORDER_ALLOWED_TRANSITIONS[current.value.status] || [] : [],
)

function statusTag(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (['completed'].includes(status)) return 'success'
  if (['exception'].includes(status)) return 'warning'
  if (['rejected', 'cancelled'].includes(status)) return 'danger'
  if (['pending_review', 'approved'].includes(status)) return 'info'
  return 'primary'
}

function fmt(ts: string): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function recipientText(r: Record<string, unknown> | null | undefined): string {
  if (!r) return '-'
  return [r.name, r.country, r.city, r.address1, r.zip].filter(Boolean).join(' / ') || '-'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    orders.value = await ordersApi.list(statusFilter.value || undefined)
  } catch (e) {
    ElMessage.error('加载订单失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function openDetail(id: string): Promise<void> {
  try {
    current.value = await ordersApi.detail(id)
    transitionTo.value = ''
    reverseType.value = ''
    reverseCause.value = ''
    drawer.value = true
  } catch (e) {
    ElMessage.error('加载详情失败：' + (e as Error).message)
  }
}

async function doReview(): Promise<void> {
  if (!current.value) return
  try {
    const res = await ordersApi.review(current.value.id)
    ElMessage.success(res.approved ? '审单通过 → approved' : '审单未通过 → rejected')
    await openDetail(current.value.id)
    await load()
  } catch (e) {
    ElMessage.error('审单失败：' + (e as Error).message)
  }
}

async function doTransition(): Promise<void> {
  if (!current.value || !transitionTo.value) return
  try {
    const res = await ordersApi.transition(current.value.id, transitionTo.value)
    if (res.changed) ElMessage.success('状态已转移')
    else ElMessage.info('订单已处于该状态（幂等）')
    transitionVisible.value = false
    await openDetail(current.value.id)
    await load()
  } catch (e) {
    ElMessage.error('转移失败：' + (e as Error).message)
  }
}

async function doReverse(): Promise<void> {
  if (!current.value || !reverseType.value) return
  try {
    await ordersApi.reverse(current.value.id, reverseType.value, reverseCause.value || '用户发起')
    ElMessage.success('逆向流程已发起')
    reverseVisible.value = false
    await openDetail(current.value.id)
    await load()
  } catch (e) {
    ElMessage.error('逆向失败：' + (e as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.filters {
  display: flex;
  gap: 8px;
}
.actions {
  display: flex;
  gap: 8px;
}
.op {
  color: #909399;
  margin-left: 4px;
}
</style>
