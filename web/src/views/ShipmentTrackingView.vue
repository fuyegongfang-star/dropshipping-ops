<template>
  <div class="ship-tracking">
    <PageHeader
      title="物流回传与轨迹"
      subtitle="订单建单 → 回传平台 → 轨迹上报，基础物流闭环（§3 推单回传 / §6 轨迹）"
      icon="link"
      accent="brand"
    >
      <template #actions>
        <span class="count-pill">{{ shipments.length }} 运单 · {{ pushedCount }} 已回传</span>
      </template>
    </PageHeader>

    <el-row :gutter="16">
      <!-- 左：建单 -->
      <el-col :span="9">
        <el-card class="book-card">
          <template #header><span class="section-title">为订单建单</span></template>
          <el-form label-position="top">
            <el-form-item label="选择订单">
              <el-select v-model="book.orderId" class="w-full" placeholder="选择要发货的订单" filterable>
                <el-option v-for="o in orders" :key="o.id" :label="`${o.platformOrderNo} · ${o.status}`" :value="o.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="承运商">
              <el-select v-model="book.carrierCode" class="w-full" placeholder="默认云途物流">
                <el-option v-for="c in carriers" :key="c.code" :label="c.name" :value="c.code" />
              </el-select>
            </el-form-item>
            <el-form-item label="运单类型">
              <el-select v-model="book.legType" class="w-full">
                <el-option label="全程（一票到底）" value="direct" />
                <el-option label="头程（国内段）" value="first" />
                <el-option label="尾程（海外段）" value="last" />
              </el-select>
            </el-form-item>
            <el-button type="primary" class="w-full run-btn" :loading="bookLoading" @click="runBook">
              <AppIcon name="bolt" :size="15" class="btn-ico" />确认建单
            </el-button>
            <p class="text-hint form-hint">
              建单即向承运商下单并落库运单 + 首条「已建单」轨迹；运费按演示口径（货值 ×18%）估算。
            </p>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右：运单列表 -->
      <el-col :span="15">
        <el-card v-loading="listLoading" class="list-card">
          <template #header>
            <div class="card-head">
              <span class="section-title">运单列表</span>
              <el-button size="small" text type="primary" :icon="undefined" @click="loadShipments">刷新</el-button>
            </div>
          </template>
          <el-table :data="shipments" size="default" row-key="id" highlight-current-row @row-click="selectShipment">
            <el-table-column label="运单号" min-width="160">
              <template #default="{ row }">
                <span class="mono">{{ row.waybillNo }}</span>
              </template>
            </el-table-column>
            <el-table-column label="订单" prop="orderId" width="92" />
            <el-table-column label="承运商" min-width="120">
              <template #default="{ row }">{{ row.carrierName || row.carrierCode }}</template>
            </el-table-column>
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="statusTag(row.status)" size="small" effect="light">
                  {{ SHIPMENT_STATUS_LABELS[row.status] || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="运费" width="110">
              <template #default="{ row }">
                <span v-if="row.carrierCost != null" class="cost-money">${{ row.carrierCost.toFixed(2) }}</span>
                <el-tag v-else size="small" type="info" effect="plain">成本待回传</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 选中运单：回传 + 轨迹上报 + 时间线 -->
    <el-card v-if="current" class="detail-card">
      <template #header>
        <div class="card-head">
          <span class="section-title">
            运单详情 · <span class="mono">{{ current.waybillNo }}</span>
          </span>
          <el-tag :type="statusTag(current.status)" size="small" effect="light">
            {{ SHIPMENT_STATUS_LABELS[current.status] || current.status }}
          </el-tag>
        </div>
      </template>

      <el-row :gutter="16">
        <!-- 回传 + 上报 -->
        <el-col :span="9">
          <div class="ops">
            <div class="ops-head">
              <AppIcon name="swap" :size="15" class="ops-ico" />回传与轨迹上报
            </div>
            <el-descriptions :column="1" border size="small" class="meta">
              <el-descriptions-item label="订单">{{ current.orderId }}</el-descriptions-item>
              <el-descriptions-item label="轨迹号">
                <span class="mono">{{ current.trackingNo || '—' }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="承运商">{{ current.carrierName || current.carrierCode }}</el-descriptions-item>
            </el-descriptions>

            <el-button
              class="w-full run-btn"
              :type="current.status === 'pushed' || current.status === 'booked' ? 'primary' : 'success'"
              :loading="fulfillLoading"
              :disabled="current.status !== 'booked'"
              @click="runFulfill"
            >
              <AppIcon name="upload" :size="15" class="btn-ico" />回传平台（推单）
            </el-button>

            <el-divider>上报轨迹节点</el-divider>
            <el-form label-position="top" class="track-form">
              <el-form-item label="节点状态">
                <el-select v-model="trackForm.status" class="w-full">
                  <el-option v-for="s in TRACK_STATUSES" :key="s" :label="TRACKING_STATUS_LABELS[s] || s" :value="s" />
                </el-select>
              </el-form-item>
              <el-form-item label="位置">
                <el-input v-model="trackForm.location" placeholder="如 深圳 / 上海转运中心" />
              </el-form-item>
              <el-form-item label="描述">
                <el-input v-model="trackForm.description" placeholder="轨迹说明" />
              </el-form-item>
              <el-button type="primary" class="w-full run-btn" :loading="trackLoading" @click="runTrack">
                <AppIcon name="radar" :size="15" class="btn-ico" />上报轨迹
              </el-button>
            </el-form>
          </div>
        </el-col>

        <!-- 轨迹时间线 -->
        <el-col :span="15">
          <div class="timeline-head">
            <AppIcon name="clock" :size="15" class="ops-ico" />轨迹时间线（{{ tracking.length }} 节点）
          </div>
          <div v-if="tracking.length" class="events">
            <div
              v-for="(ev, i) in tracking"
              :key="i"
              class="ev"
              :class="ev.status === 'exception' ? 'ev-bad' : ''"
            >
              <span class="ev-dot" />
              <div class="ev-body">
                <span class="ev-status">{{ TRACKING_STATUS_LABELS[ev.status] || ev.status }}</span>
                <span class="ev-desc">{{ ev.description }}</span>
                <span v-if="ev.location" class="ev-loc">{{ ev.location }} · {{ fmt(ev.occurredAt) }}</span>
                <span v-else class="ev-loc">{{ fmt(ev.occurredAt) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="app-empty">
            <span class="app-empty-ico"><AppIcon name="clock" :size="26" /></span>
            <span class="app-empty-text">暂无轨迹，点击左侧「上报轨迹」补充节点</span>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { shipmentsApi, SHIPMENT_STATUS_LABELS, TRACKING_STATUS_LABELS, type ShipmentVo, type TrackingVo, type BookShipmentInput, type RecordTrackingInput } from '@/api/shipments'
import { ordersApi } from '@/api/orders'
import { carriersApi } from '@/api/carriers'
import type { Carrier } from '@/api/carriers'
import type { Order } from '@/api/orders'

// 物流回传与轨迹基础页（任务 1.6，§3 推单回传 / §6 轨迹）。
// 串联「订单 → 建单 → 回传平台 → 轨迹上报 → 时间线」，演示与正式双路均通。

const TRACK_STATUSES = ['picked_up', 'in_transit', 'customs_clearing', 'out_for_delivery', 'delivered', 'exception']

const shipments = ref<ShipmentVo[]>([])
const orders = ref<Order[]>([])
const carriers = ref<Carrier[]>([])
const current = ref<ShipmentVo | null>(null)
const tracking = ref<TrackingVo[]>([])
const listLoading = ref(false)
const bookLoading = ref(false)
const fulfillLoading = ref(false)
const trackLoading = ref(false)

const pushedCount = computed(() => shipments.value.filter((s) => s.status === 'pushed').length)

const book = reactive<BookShipmentInput & { legType: string }>({
  orderId: '',
  carrierCode: 'yunexpress',
  legType: 'direct',
})
const trackForm = reactive<RecordTrackingInput>({ status: 'picked_up', location: '', description: '' })

// 状态标签颜色：回传前中性，运输中蓝，妥投绿，异常红。
function statusTag(status: string): 'info' | 'primary' | 'warning' | 'success' | 'danger' {
  if (status === 'booked') return 'info'
  if (status === 'pushed') return 'primary'
  if (status === 'delivered') return 'success'
  if (status === 'exception') return 'danger'
  if (status === 'customs_clearing') return 'warning'
  return 'primary'
}

function fmt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function loadShipments(): Promise<void> {
  listLoading.value = true
  try {
    shipments.value = (await shipmentsApi.list()) ?? []
  } catch {
    shipments.value = []
  } finally {
    listLoading.value = false
  }
}

async function loadTracking(id: string): Promise<void> {
  try {
    tracking.value = (await shipmentsApi.listTracking(id)) ?? []
  } catch {
    tracking.value = []
  }
}

async function selectShipment(row: ShipmentVo): Promise<void> {
  current.value = row
  await loadTracking(row.id)
}

async function runBook(): Promise<void> {
  if (!book.orderId) {
    ElMessage.warning('请先选择订单')
    return
  }
  bookLoading.value = true
  try {
    const created = await shipmentsApi.book({ orderId: book.orderId, carrierCode: book.carrierCode, legType: book.legType })
    ElMessage.success(`已为 ${book.orderId} 建单：${created.waybillNo}`)
    await loadShipments()
    current.value = created
    await loadTracking(created.id)
  } catch (e) {
    ElMessage.error('建单失败：' + (e as Error).message)
  } finally {
    bookLoading.value = false
  }
}

async function runFulfill(): Promise<void> {
  if (!current.value) return
  fulfillLoading.value = true
  try {
    const res = await shipmentsApi.fulfill(current.value.id)
    ElMessage.success(res.message)
    await loadShipments()
    current.value = shipments.value.find((s) => s.id === current.value!.id) ?? null
    if (current.value) await loadTracking(current.value.id)
  } catch (e) {
    ElMessage.error('回传失败：' + (e as Error).message)
  } finally {
    fulfillLoading.value = false
  }
}

async function runTrack(): Promise<void> {
  if (!current.value) {
    ElMessage.warning('请先选择运单')
    return
  }
  trackLoading.value = true
  try {
    await shipmentsApi.recordTracking(current.value.id, { ...trackForm })
    ElMessage.success('轨迹已上报')
    await loadShipments()
    await loadTracking(current.value.id)
  } catch (e) {
    ElMessage.error('上报失败：' + (e as Error).message)
  } finally {
    trackLoading.value = false
  }
}

onMounted(async () => {
  try {
    orders.value = (await ordersApi.list()) ?? []
    carriers.value = (await carriersApi.list()) ?? []
  } catch {
    orders.value = []
    carriers.value = []
  }
  await loadShipments()
  if (shipments.value.length) await selectShipment(shipments.value[0])
})
</script>

<style scoped>
.w-full { width: 100%; }
.btn-ico { margin-right: 5px; }
.count-pill {
  font-size: 12px; font-weight: 600; color: var(--brand-700);
  background: var(--brand-soft); padding: 4px 10px; border-radius: var(--r-pill);
}
.card-head { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.card-head .section-title { margin: 0; }
.section-title { font-size: 14px; font-weight: 700; color: var(--ink-900); }
.form-hint { margin: 14px 0 0; }
.run-btn { margin-top: 4px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }

/* 建单卡片 */
.book-card :deep(.el-card__body) { padding: 18px 20px; }

/* 运单列表 */
.list-card :deep(.el-card__body) { padding: 14px 16px; }
.list-card :deep(.el-table__row) { cursor: pointer; }

/* 详情 */
.detail-card { margin-top: 16px; }
.ops-head, .timeline-head {
  display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 700;
  color: var(--ink-900); margin-bottom: 12px;
}
.ops-ico { color: var(--brand-500); }
.meta { margin-bottom: 14px; }
.track-form :deep(.el-card__body) { padding: 0; }
.track-form { margin-top: 4px; }
.detail-card :deep(.el-divider__text) { font-size: 12px; color: var(--ink-500); }

/* 轨迹时间线 */
.events { display: flex; flex-direction: column; gap: 0; border-left: 2px solid var(--line); margin-left: 6px; padding-left: 4px; }
.ev { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0 8px 12px; position: relative; }
.ev::before { content: ''; position: absolute; left: -19px; top: 14px; width: 10px; height: 10px; border-radius: 50%; background: var(--brand-500); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line); }
.ev-bad::before { background: #dc2626; }
.ev-body { display: flex; flex-direction: column; gap: 2px; }
.ev-status { font-size: 13px; font-weight: 700; color: var(--ink-900); }
.ev-desc { font-size: 12.5px; color: var(--ink-700); }
.ev-loc { font-size: 11.5px; color: var(--ink-400); }
.form-hint code { background: var(--bg); padding: 1px 5px; border-radius: 4px; font-size: 12px; color: var(--brand-700); }
/* 运费列：有成本时正常展示，无成本（待回传）时由 el-tag 承载 */
.cost-money { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--brand-600); }
.app-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 0; color: var(--ink-400); }
.app-empty-ico { color: var(--ink-300); }
.app-empty-text { font-size: 13px; }
</style>
