<template>
  <div class="tf">
    <PageHeader
      title="中转仓作业看板"
      subtitle="货代中转仓：待作业采购单汇聚 · 扫码入库 → 打包 → 出跨境面单 → 出库"
      icon="warehouse"
      accent="violet"
    >
      <template #actions>
        <el-button type="primary" @click="openScan">
          <AppIcon name="package" :size="15" class="btn-ico" />扫码到货
        </el-button>
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

    <!-- 扫码到货入库（6.6） -->
    <el-dialog v-model="scanVisible" title="扫码到货入库" width="560px" :close-on-click-modal="false">
      <el-form label-width="92px" class="scan-form">
        <el-form-item label="目标中转仓">
          <el-select v-model="scanForm.warehouseId" placeholder="选择中转仓" style="width: 100%">
            <el-option v-for="w in whs" :key="w.id" :label="`${w.name}（${w.region || '—'}）`" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="扫码类型">
          <el-radio-group v-model="scanForm.scanType">
            <el-radio value="trackingNo">快递单号</el-radio>
            <el-radio value="barcode">SKU 条码</el-radio>
            <el-radio value="purchaseNo">采购单号</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="扫码值">
          <el-input v-model="scanForm.scanValue" :placeholder="scanPlaceholder" clearable />
        </el-form-item>
        <el-form-item>
          <div class="tips">
            <span class="muted">演示数据：</span>
            <el-tag size="small" class="tip-tag" @click="fillDemo('trackingNo')">快递单号 SF1234567890</el-tag>
            <el-tag size="small" class="tip-tag" @click="fillDemo('barcode')">条码 690000000001</el-tag>
            <el-tag size="small" class="tip-tag" @click="fillDemo('purchaseNo')">采购单号 po_demo_1</el-tag>
          </div>
        </el-form-item>
      </el-form>

      <div v-if="scanResult" class="scan-result">
        <div class="sr-head">
          <AppIcon name="check" :size="16" class="sr-ico" />
          <span>到货登记成功</span>
          <span class="sr-id mono">ASN {{ scanResult.asn.id }}</span>
        </div>
        <div class="sr-grid">
          <div class="sr-cell">
            <span class="sr-k">采购单号</span><span class="sr-v mono">{{ scanResult.purchaseOrder.trackingNo }}</span>
          </div>
          <div class="sr-cell">
            <span class="sr-k">物流公司</span><span class="sr-v">{{ scanResult.purchaseOrder.carrier }}</span>
          </div>
          <div class="sr-cell">
            <span class="sr-k">当前状态</span>
            <span class="sr-v"><span class="tag-soft" :class="statusClass(scanResult.purchaseOrder.status)">{{ statusLabel(scanResult.purchaseOrder.status) }}</span></span>
          </div>
          <div class="sr-cell">
            <span class="sr-k">到货行项</span><span class="sr-v">{{ scanResult.asn.receivedItemCount }} 项</span>
          </div>
        </div>
        <div class="sr-badges">
          <span class="tag-soft" :class="scanResult.advanced ? 'tag-blue' : 'tag-gray'">
            状态推进 {{ scanResult.advanced ? '已执行' : '无变化' }}
          </span>
          <span class="tag-soft" :class="scanResult.matched ? 'tag-green' : 'tag-gray'">
            订单匹配 {{ scanResult.matched ? '已关联' : '未匹配' }}
          </span>
          <span v-if="scanResult.purchaseOrder.orderId" class="mono muted">关联订单 {{ scanResult.purchaseOrder.orderId }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="scanVisible = false">关闭</el-button>
        <el-button type="primary" :loading="scanning" @click="submitScan">确认到货</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { transferApi, type TransferBoard, type TransferWarehouse, type TransferBoardPo, type ScanTransferDto, type ScanTransferResult } from '@/api/transfer'
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

// ===== 6.6 扫码到货入库 =====
const scanVisible = ref(false)
const scanning = ref(false)
const scanForm = ref<ScanTransferDto>({ warehouseId: '', scanValue: '', scanType: 'trackingNo' })
const scanResult = ref<ScanTransferResult | null>(null)

const scanPlaceholder = computed(() => {
  switch (scanForm.value.scanType) {
    case 'trackingNo':
      return '输入采购快递单号，如 SF1234567890'
    case 'barcode':
      return '输入 SKU 条码，如 690000000001'
    case 'purchaseNo':
      return '输入采购单号，如 po_demo_1'
    default:
      return ''
  }
})

function openScan(): void {
  scanForm.value = {
    warehouseId: whs.value[0]?.id ?? '',
    scanValue: '',
    scanType: 'trackingNo',
  }
  scanResult.value = null
  scanVisible.value = true
}

function fillDemo(type: ScanTransferDto['scanType']): void {
  scanForm.value.scanType = type
  scanForm.value.scanValue = type === 'trackingNo' ? 'SF1234567890' : type === 'barcode' ? '690000000001' : 'po_demo_1'
}

async function submitScan(): Promise<void> {
  if (!scanForm.value.warehouseId) {
    ElMessage.warning('请选择目标中转仓')
    return
  }
  if (!scanForm.value.scanValue.trim()) {
    ElMessage.warning('请输入扫码值')
    return
  }
  scanning.value = true
  try {
    const res = await transferApi.scan({ ...scanForm.value })
    scanResult.value = res
    ElMessage.success(res.message)
    await load() // 刷新看板：采购单状态推进即时可见
  } catch (e) {
    ElMessage.error('扫码到货失败：' + (e as Error).message)
  } finally {
    scanning.value = false
  }
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
.scan-form {
  margin-top: 4px;
}
.tips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.tip-tag {
  cursor: pointer;
  transition: transform 0.12s ease;
}
.tip-tag:hover {
  transform: translateY(-1px);
}
.scan-result {
  margin-top: 8px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: var(--bg-soft);
  padding: 14px 16px;
}
.sr-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--ink-900);
  margin-bottom: 12px;
}
.sr-ico {
  color: #16a34a;
}
.sr-id {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-500);
}
.sr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  margin-bottom: 12px;
}
.sr-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sr-k {
  font-size: 12px;
  color: var(--ink-500);
}
.sr-v {
  font-size: 14px;
  color: var(--ink-800);
  font-weight: 500;
}
.sr-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
