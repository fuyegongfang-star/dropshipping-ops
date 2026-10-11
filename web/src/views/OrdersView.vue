<template>
  <div class="orders">
    <PageHeader
      title="订单中心"
      subtitle="订单归集 · 审单引擎 · 状态机流转 · 逆向流程"
      icon="orders"
      accent="brand"
    >
      <template #actions>
        <el-select
          v-model="statusFilter"
          class="filter-select"
          placeholder="全部状态"
          clearable
          @change="load"
        >
          <el-option v-for="(label, val) in statusLabels" :key="val" :label="label" :value="val" />
        </el-select>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />
          刷新
        </el-button>
      </template>
    </PageHeader>

    <el-card>
      <template #header>
        <div class="card-head">
          <span class="section-title">订单列表</span>
          <span class="count-pill">共 {{ orders.length }} 条</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="orders">
        <el-table-column prop="platformOrderNo" label="平台单号" min-width="165">
          <template #default="{ row }">
            <span class="mono">{{ row.platformOrderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="店铺" min-width="145">
          <template #default="{ row }">
            <span class="cell-shop">
              <AppIcon name="shop" :size="14" />
              {{ row.shop?.name || row.shopId }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <span class="tag-soft" :class="statusClass(row.status)">
              {{ statusLabels[row.status] || row.status }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="125">
          <template #default="{ row }">
            <span class="money">
              {{ row.totalAmount != null ? Number(row.totalAmount).toFixed(2) : '-' }}
              <em>{{ row.currency || '' }}</em>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }"><span class="muted">{{ fmt(row.createdAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="95" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row.id)">
              详情
              <AppIcon name="arrowRight" :size="14" class="btn-ico-xs" />
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <div class="app-empty">
            <span class="app-empty-ico"><AppIcon name="orders" :size="26" /></span>
            <span class="app-empty-text">暂无订单，可到「渠道 / 店铺」对 Mock 店点拉单生成</span>
          </div>
        </template>
      </el-table>
    </el-card>

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawer" size="48%" class="order-drawer">
      <template #header>
        <div class="drawer-title">
          <span class="dt-ico"><AppIcon name="package" :size="18" /></span>
          <span class="dt-main">订单详情</span>
          <span class="dt-sub">{{ current?.platformOrderNo || '' }}</span>
        </div>
      </template>

      <template v-if="current">
        <el-card class="sec">
          <div class="sec-head">
            <span class="section-title">基本信息</span>
            <span class="tag-soft" :class="statusClass(current.status)">
              {{ statusLabels[current.status] || current.status }}
            </span>
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="店铺">
              {{ current.shop?.name || current.shopId }}
            </el-descriptions-item>
            <el-descriptions-item label="平台单号">
              <span class="mono">{{ current.platformOrderNo }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="金额">
              <span class="money">
                {{ current.totalAmount != null ? Number(current.totalAmount).toFixed(2) : '-' }}
                <em>{{ current.currency }}</em>
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ fmt(current.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="收件人" :span="2">
              {{ recipientText(current.recipient) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card class="sec">
          <div class="sec-head"><span class="section-title">订单明细（三段映射）</span></div>
          <el-table :data="current.items || []" size="small" border empty-text="暂无明细">
            <el-table-column label="内部SKU">
              <template #default="{ row }">{{ row.sku?.code || '—' }}</template>
            </el-table-column>
            <el-table-column label="平台SKU">
              <template #default="{ row }">{{ row.sku?.platformSku || '—' }}</template>
            </el-table-column>
            <el-table-column label="供应商SKU">
              <template #default="{ row }">{{ row.sku?.supplierSku || '—' }}</template>
            </el-table-column>
            <el-table-column prop="quantity" label="数量" width="74" />
          </el-table>
        </el-card>

        <el-card class="sec">
          <div class="sec-head"><span class="section-title">状态流转轨迹</span></div>
          <el-timeline v-if="(current.events || []).length" class="tl">
            <el-timeline-item
              v-for="e in current.events || []"
              :key="e.id"
              :timestamp="fmt(e.createdAt)"
              placement="top"
              color="var(--brand-500)"
              :size="10"
            >
              <span class="tl-type">{{ e.type }}</span>
              <span v-if="e.operator" class="tl-op">· {{ e.operator }}</span>
            </el-timeline-item>
          </el-timeline>
          <div v-else class="app-empty small">
            <span class="app-empty-text">暂无流转记录</span>
          </div>
        </el-card>

        <el-card class="sec">
          <div class="sec-head"><span class="section-title">操作</span></div>
          <div class="actions">
            <el-button type="primary" @click="doReview">
              <AppIcon name="check" :size="15" class="btn-ico" />审单
            </el-button>
            <el-button type="success" @click="transitionVisible = true">
              <AppIcon name="swap" :size="15" class="btn-ico" />状态转移
            </el-button>
            <el-button type="warning" @click="reverseVisible = true">
              <AppIcon name="warning" :size="15" class="btn-ico" />逆向
            </el-button>
          </div>
          <p class="text-hint mt">
            审单=地址/黑名单/库存/合规校验；状态转移按状态机候选；逆向=取消 / 退货 / 拦截 / 退件。
          </p>
        </el-card>

        <!-- 状态转移 -->
        <el-dialog v-model="transitionVisible" title="状态转移" width="400" append-to-body>
          <el-form label-width="84">
            <el-form-item label="目标状态">
              <el-select v-model="transitionTo" placeholder="选择目标状态" class="full">
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
        <el-dialog v-model="reverseVisible" title="发起逆向流程" width="440" append-to-body>
          <el-form label-width="84">
            <el-form-item label="类型">
              <el-select v-model="reverseType" placeholder="选择逆向类型" class="full">
                <el-option v-for="(label, val) in reverseTypes" :key="val" :label="label" :value="val" />
              </el-select>
            </el-form-item>
            <el-form-item label="原因">
              <el-input v-model="reverseCause" type="textarea" :rows="2" placeholder="如：客户取消订单" />
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
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

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

/** 状态 → 柔和标签配色类 */
function statusClass(status: string): string {
  if (status === 'completed') return 'tag-green'
  if (status === 'exception') return 'tag-orange'
  if (status === 'rejected' || status === 'cancelled') return 'tag-red'
  if (status === 'approved') return 'tag-brand'
  if (['fulfilled', 'shipped', 'in_transit'].includes(status)) return 'tag-teal'
  if (status === 'pending_review') return 'tag-amber'
  return 'tag-gray'
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
.filter-select {
  width: 150px;
}
.btn-ico {
  margin-right: 5px;
}
.btn-ico-xs {
  margin-left: 2px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.card-head .section-title {
  margin: 0;
}
.count-pill {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}
.mono {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ink-800);
}
.muted {
  color: var(--ink-500);
}
.cell-shop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink-700);
}
.money {
  font-weight: 600;
  color: var(--ink-900);
}
.money em {
  font-style: normal;
  color: var(--ink-400);
  font-weight: 500;
  font-size: 12px;
  margin-left: 3px;
}

/* 抽屉 */
.drawer-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dt-ico {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--brand-soft);
  color: var(--brand-600);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dt-main {
  font-weight: 700;
  font-size: 16px;
  color: var(--ink-900);
}
.dt-sub {
  font-size: 13px;
  color: var(--ink-400);
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.order-drawer :deep(.el-drawer__body) {
  padding: 20px;
  background: var(--bg);
}
.sec {
  margin-bottom: 14px;
}
.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.sec-head .section-title {
  margin: 0;
}
.tl-type {
  font-weight: 600;
  color: var(--ink-800);
}
.tl-op {
  color: var(--ink-400);
  margin-left: 4px;
}
.app-empty.small {
  padding: 20px 0;
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.mt {
  margin: 12px 0 0;
}
.full {
  width: 100%;
}
</style>
