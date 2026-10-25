<template>
  <div class="tf">
    <PageHeader
      title="中转仓作业看板"
      subtitle="货代中转仓：待作业采购单汇聚 · 扫码入库 → 打包 → 出跨境面单 → 出库"
      icon="warehouse"
      accent="violet"
    >
      <template #actions>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新看板
        </el-button>
      </template>
    </PageHeader>

    <!-- 态势统计 -->
    <div class="stats">
      <div class="stat">
        <span class="stat-ico"><AppIcon name="warehouse" :size="20" /></span>
        <div class="stat-body">
          <div class="stat-num">{{ board?.stats.transferWarehouseCount ?? 0 }}</div>
          <div class="stat-label">本租户中转仓</div>
        </div>
      </div>
      <div class="stat">
        <span class="stat-ico alt"><AppIcon name="package" :size="20" /></span>
        <div class="stat-body">
          <div class="stat-num">{{ board?.stats.pendingPoCount ?? 0 }}</div>
          <div class="stat-label">待作业采购单</div>
        </div>
      </div>
      <div class="stat">
        <span class="stat-ico alt2"><AppIcon name="link" :size="20" /></span>
        <div class="stat-body">
          <div class="stat-num">{{ linkedCount }}</div>
          <div class="stat-label">已关联店铺订单</div>
        </div>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 中转仓列表 -->
      <el-col :xs="24" :lg="8">
        <el-card class="sec">
          <template #header><span class="section-title">中转仓</span></template>
          <div v-loading="loading" class="wh-list">
            <div v-if="!whs.length" class="app-empty small">
              <span class="app-empty-text">本租户暂无中转仓</span>
            </div>
            <div v-for="w in whs" :key="w.id" class="wh">
              <span class="wh-ico"><AppIcon name="warehouse" :size="18" /></span>
              <div class="wh-body">
                <div class="wh-name">{{ w.name }}</div>
                <div class="muted">{{ w.region || '—' }} · {{ w.id }}</div>
              </div>
              <span class="tag-soft tag-indigo">中转仓</span>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 待作业采购单 -->
      <el-col :xs="24" :lg="16">
        <el-card class="sec">
          <template #header>
            <div class="card-head">
              <span class="section-title">待作业采购单（已到仓 / 已匹配 / 已打包）</span>
              <span class="count-pill">共 {{ pos.length }} 单</span>
            </div>
          </template>
          <el-table v-loading="loading" :data="pos" row-key="id" empty-text="暂无待作业采购单">
            <el-table-column label="快递单号" min-width="160">
              <template #default="{ row }"><span class="mono">{{ row.trackingNo }}</span></template>
            </el-table-column>
            <el-table-column label="物流公司" width="110" prop="carrier" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }"><span class="tag-soft" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></template>
            </el-table-column>
            <el-table-column label="关联店铺订单" min-width="220">
              <template #default="{ row }">
                <div v-if="row.order" class="order">
                  <span class="mono">{{ row.order.platformOrderNo || row.order.id }}</span>
                  <span class="muted">· {{ orderStatusLabel(row.order.status) }}</span>
                  <span v-if="row.order.recipientName" class="muted">· {{ row.order.recipientName }}</span>
                </div>
                <span v-else class="muted">未关联</span>
              </template>
            </el-table-column>
            <el-table-column label="产品" min-width="160">
              <template #default="{ row }">
                <span class="muted">{{ itemSummary(row) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { transferApi, type TransferBoard, type TransferWarehouse, type TransferBoardPo } from '@/api/transfer'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  arrived: '已到货',
  matched: '已匹配',
  packed: '已打包',
  outbound: '已出库',
}
const STATUS_CLASS: Record<string, string> = {
  pending: 'tag-gray',
  arrived: 'tag-blue',
  matched: 'tag-green',
  packed: 'tag-orange',
  outbound: 'tag-violet',
}
const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_review: '待审单',
  approved: '已通过',
  pending: '待处理',
  fulfilled: '已履约',
  shipped: '已发货',
  in_transit: '运输中',
  completed: '已完成',
  exception: '异常',
  cancelled: '已取消',
  rejected: '已拒绝',
}

const board = ref<TransferBoard | null>(null)
const loading = ref(false)

const whs = computed<TransferWarehouse[]>(() => board.value?.warehouses ?? [])
const pos = computed<TransferBoardPo[]>(() => board.value?.purchaseOrders ?? [])
const linkedCount = computed(() => pos.value.filter((p) => p.orderId).length)

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s
}
function statusClass(s: string): string {
  return STATUS_CLASS[s] ?? 'tag-gray'
}
function orderStatusLabel(s: string): string {
  return ORDER_STATUS_LABELS[s] ?? s
}
function itemSummary(row: TransferBoardPo): string {
  if (!row.items || !row.items.length) return '—'
  return row.items.map((i) => `${i.productName}×${i.quantity}`).join('，')
}

async function load(): Promise<void> {
  loading.value = true
  try {
    board.value = await transferApi.board()
  } catch (e) {
    ElMessage.error('加载中转仓看板失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
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
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.12);
  padding: 4px 10px;
  border-radius: 999px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.stat {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: var(--r-md);
  background: #fff;
  border: 1px solid var(--line);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.stat-ico,
.stat-ico.alt,
.stat-ico.alt2 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
}
.stat-ico {
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.12);
}
.stat-ico.alt {
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.12);
}
.stat-ico.alt2 {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.12);
}
.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: var(--ink-900);
  line-height: 1.1;
}
.stat-label {
  font-size: 12px;
  color: var(--ink-500);
}
.wh-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.wh {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: var(--bg-soft);
}
.wh-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.12);
}
.wh-body {
  flex: 1;
}
.wh-name {
  font-weight: 600;
  color: var(--ink-800);
}
.tag-indigo {
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.12);
}
.mono {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ink-800);
}
.muted {
  color: var(--ink-500);
}
.order {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 13px;
}
</style>
