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
      <div class="stat">
        <span class="stat-ico alt3"><AppIcon name="check" :size="20" /></span>
        <div class="stat-body">
          <div class="stat-num">{{ queue?.stats.pendingTaskCount ?? 0 }}</div>
          <div class="stat-label">待打包任务</div>
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

    <!-- 打包作业（6.7）：待打包队列 + 核对 + 标记打包 -->
    <el-card class="sec pack-sec">
      <template #header>
        <div class="card-head">
          <span class="section-title">打包作业（待打包队列 · 采购 ↔ 订单核对）</span>
          <div class="head-actions">
            <span class="count-pill alt">差异订单 {{ diffCount }}</span>
            <span class="count-pill">待打包 {{ queue?.stats.pendingTaskCount ?? 0 }}</span>
            <el-button type="primary" :loading="genLoading" @click="generateTasks">
              <AppIcon name="plus" :size="14" class="btn-ico" />生成打包任务
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="packLoading" :data="queueItems" row-key="orderId" empty-text="暂无待打包订单（需先有「已匹配且已关联订单」的采购单，可先扫码到货并匹配）">
        <el-table-column label="店铺订单" min-width="170">
          <template #default="{ row }">
            <span class="mono">{{ row.order?.platformOrderNo || row.orderId }}</span>
            <div class="muted sm">{{ orderStatusLabel(row.order?.status ?? '') }}</div>
          </template>
        </el-table-column>
        <el-table-column label="聚合采购单" min-width="230">
          <template #default="{ row }">
            <div class="po-chips">
              <span v-for="p in row.purchaseOrders" :key="p.id" class="po-chip mono">{{ p.trackingNo }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="核对预览" min-width="240">
          <template #default="{ row }">
            <div class="diff-mini">
              <span class="d-chip ok">一致 {{ row.summary.matched }}</span>
              <span v-if="row.summary.qtyMismatch" class="d-chip warn">数量 {{ row.summary.qtyMismatch }}</span>
              <span v-if="row.summary.missing" class="d-chip bad">缺货 {{ row.summary.missing }}</span>
              <span v-if="row.summary.extra" class="d-chip bad">多采 {{ row.summary.extra }}</span>
              <span v-if="row.summary.unverified" class="d-chip bad">待核 {{ row.summary.unverified }}</span>
              <span v-if="!row.summary.hasDifference" class="d-chip ok">全部一致</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="任务状态" width="120">
          <template #default="{ row }">
            <span v-if="row.task" class="tag-soft" :class="taskStatusClass(row.task.status)">{{ taskStatusLabel(row.task.status) }}</span>
            <span v-else class="muted">未生成</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openCheck(row)">核对</el-button>
            <el-button v-if="row.task && row.task.status === 'pending'" size="small" type="primary" :loading="packingId === row.task.id" @click="pack(row)">打包</el-button>
            <el-button v-else-if="row.task && row.task.status === 'packed'" size="small" disabled>已打包</el-button>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 已建打包任务（生成后可见全生命周期） -->
      <div v-if="tasks.length" class="task-sub">
        <div class="section-subtitle">已建打包任务（{{ tasks.length }}）</div>
        <el-table :data="tasks" row-key="id" size="small">
          <el-table-column label="任务 ID" min-width="150">
            <template #default="{ row }"><span class="mono">{{ row.id }}</span></template>
          </el-table-column>
          <el-table-column label="店铺订单" min-width="160">
            <template #default="{ row }"><span class="mono">{{ row.order?.platformOrderNo || row.orderId || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="聚合采购单" min-width="220">
            <template #default="{ row }">
              <span v-for="p in row.purchaseOrders" :key="p.id" class="po-chip mono">{{ p.trackingNo }}</span>
            </template>
          </el-table-column>
            <el-table-column label="渠道" width="120">
              <template #default="{ row }">
                <span v-if="row.channelCode" class="tag-soft tag-indigo">{{ channelName(row.channelCode) }}</span>
                <span v-else class="muted">未出单</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }"><span class="tag-soft" :class="taskStatusClass(row.status)">{{ taskStatusLabel(row.status) }}</span></template>
            </el-table-column>
            <el-table-column label="打包时间" width="170">
              <template #default="{ row }"><span class="muted">{{ row.packedAt ? fmt(row.packedAt) : '—' }}</span></template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
              <template #default="{ row }">
                <el-button v-if="!row.channelCode" size="small" type="primary" :loading="labelGen && labelTaskId === row.id" @click="openLabel(row)">生成面单</el-button>
                <el-button v-else size="small" @click="openLabel(row)">查看面单</el-button>
              </template>
            </el-table-column>
          </el-table>
      </div>
    </el-card>

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

    <!-- 打包核对（6.7）：采购行项 vs 店铺订单行项差异明细 -->
    <el-dialog v-model="checkVisible" title="打包核对差异" width="760px" :close-on-click-modal="false">
      <div v-if="checkItem" class="check-body">
        <div class="check-head">
          <div>
            <span class="muted">店铺订单</span>
            <span class="mono strong">{{ checkItem.order?.platformOrderNo || checkItem.orderId }}</span>
          </div>
          <div class="check-summary">
            <span class="d-chip ok">一致 {{ checkItem.summary.matched }}</span>
            <span v-if="checkItem.summary.qtyMismatch" class="d-chip warn">数量不符 {{ checkItem.summary.qtyMismatch }}</span>
            <span v-if="checkItem.summary.missing" class="d-chip bad">缺货 {{ checkItem.summary.missing }}</span>
            <span v-if="checkItem.summary.extra" class="d-chip bad">多采 {{ checkItem.summary.extra }}</span>
            <span v-if="checkItem.summary.unverified" class="d-chip bad">待核 {{ checkItem.summary.unverified }}</span>
          </div>
        </div>

        <el-alert v-if="checkItem.summary.hasDifference" type="warning" :closable="false" show-icon title="存在差异，请人工复核后再打包" />
        <el-alert v-else type="success" :closable="false" show-icon title="核对一致，可直接打包" />

        <el-table :data="checkItem.diffs" row-key="skuId" class="check-table">
          <el-table-column label="商品 / SKU" min-width="200">
            <template #default="{ row }">
              <span class="strong">{{ row.name }}</span>
              <span v-if="row.skuId" class="muted sm mono">· {{ row.skuId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单需求" width="100" prop="orderQty" align="right" />
          <el-table-column label="采购数量" width="100" prop="poQty" align="right" />
          <el-table-column label="差异" width="90" align="right">
            <template #default="{ row }"><span :class="diffClass(row.status)">{{ row.diff > 0 ? '+' : '' }}{{ row.diff }}</span></template>
          </el-table-column>
          <el-table-column label="结论" min-width="150">
            <template #default="{ row }">
              <span class="tag-soft" :class="diffClass(row.status)">{{ diffLabel(row.status) }}</span>
              <div class="muted sm">{{ row.message }}</div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <el-button @click="checkVisible = false">关闭</el-button>
        <el-button
          v-if="currentCheckTaskId"
          type="primary"
          :disabled="packingId === currentCheckTaskId"
          :loading="packingId === currentCheckTaskId"
          @click="packFromCheck"
        >标记打包</el-button>
      </template>
    </el-dialog>

    <!-- 跨境面单生成 / 预览（6.8）：选渠道 → 建单 + ZPL/预览面单 → 打印 -->
    <el-dialog v-model="labelVisible" title="跨境面单" width="580px" :close-on-click-modal="false">
      <div v-if="labelData || labelStep === 'choose'">
        <div v-if="labelStep === 'choose'" class="label-choose">
          <p class="muted">选择跨境渠道生成面单（建单落库 + 生成 ZPL / 预览，回填打包任务）：</p>
          <el-radio-group v-model="labelForm.channelCode" class="channel-group">
            <el-radio v-for="c in channels" :key="c.code" :value="c.code" border>{{ c.name }}</el-radio>
          </el-radio-group>
        </div>
        <div v-else-if="labelData" class="label-preview">
          <div class="lp-head">
            <span class="tag-soft tag-indigo">{{ channelName(labelData.channelCode) }}</span>
            <span class="mono">{{ labelData.trackingNo }}</span>
          </div>
          <img v-if="labelData.pdfUrl" :src="labelData.pdfUrl" class="lp-img" alt="面单预览" />
          <el-collapse class="lp-zpl">
            <el-collapse-item title="ZPL 标签源文（供 ZPL 打印机）">
              <pre class="zpl">{{ labelData.zpl }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
      <template #footer>
        <el-button @click="labelVisible = false">关闭</el-button>
        <el-button v-if="labelStep === 'choose'" type="primary" :loading="labelGen" @click="generateLabel">生成面单</el-button>
        <el-button v-else-if="labelData" type="primary" @click="printLabel">打印</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { transferApi, type TransferBoard, type TransferWarehouse, type TransferBoardPo, type ScanTransferDto, type ScanTransferResult, type PackQueue, type PackQueueItem, type PackTaskDto, type ShippingLabelDto } from '@/api/transfer'
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

// ===== 6.7 中转仓打包任务 + 核对 =====
const packLoading = ref(false)
const genLoading = ref(false)
const queue = ref<PackQueue | null>(null)
const tasks = ref<PackTaskDto[]>([])
const packingId = ref<string | null>(null)
const checkVisible = ref(false)
const checkItem = ref<PackQueueItem | null>(null)
const currentCheckTaskId = computed<string | null>(() => checkItem.value?.task?.id ?? null)

const queueItems = computed<PackQueueItem[]>(() => queue.value?.items ?? [])
const diffCount = computed(
  () => queueItems.value.filter((it) => it.summary.hasDifference).length,
)

function taskStatusLabel(s: string): string {
  return s === 'packed' ? '已打包' : s === 'pending' ? '待打包' : s
}
function taskStatusClass(s: string): string {
  return s === 'packed' ? 'tag-orange' : 'tag-gray'
}
function diffLabel(s: string): string {
  const map: Record<string, string> = {
    matched: '一致',
    qty_mismatch: '数量不符',
    missing_in_po: '缺货 / 未覆盖',
    extra_in_po: '多采',
    unverified: '待人工核',
  }
  return map[s] ?? s
}
function diffClass(s: string): string {
  const map: Record<string, string> = {
    matched: 'tag-green',
    qty_mismatch: 'tag-orange',
    missing_in_po: 'tag-red',
    extra_in_po: 'tag-red',
    unverified: 'tag-red',
  }
  return map[s] ?? 'tag-gray'
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

async function loadPack(): Promise<void> {
  packLoading.value = true
  try {
    const [q, t] = await Promise.all([transferApi.packQueue(), transferApi.listPackTasks()])
    queue.value = q
    tasks.value = t
  } catch (e) {
    ElMessage.error('加载打包作业失败：' + (e as Error).message)
  } finally {
    packLoading.value = false
  }
}

/** 生成打包任务：对每一个「已匹配且已关联订单」的采购单聚合组创建待打包任务（幂等）。 */
async function generateTasks(): Promise<void> {
  genLoading.value = true
  try {
    const res = await transferApi.generatePackTasks()
    ElMessage.success(`已生成 ${res.created} 个打包任务`)
    await loadPack()
  } catch (e) {
    ElMessage.error('生成打包任务失败：' + (e as Error).message)
  } finally {
    genLoading.value = false
  }
}

/** 打开核对对话框：直接展示队列中已预计算的差异（采购行项 vs 订单行项）。 */
function openCheck(row: PackQueueItem): void {
  checkItem.value = row
  checkVisible.value = true
}

/** 标记打包：推进聚合采购单 matched/arrived → packed，并置任务为 packed（幂等）。 */
async function pack(row: PackQueueItem): Promise<void> {
  if (!row.task) return
  packingId.value = row.task.id
  try {
    await transferApi.pack(row.task.id)
    ElMessage.success('打包完成，关联采购单已推进至 packed')
    await loadPack()
  } catch (e) {
    ElMessage.error('打包失败：' + (e as Error).message)
  } finally {
    packingId.value = null
  }
}

async function packFromCheck(): Promise<void> {
  if (!currentCheckTaskId.value) return
  packingId.value = currentCheckTaskId.value
  try {
    await transferApi.pack(currentCheckTaskId.value)
    ElMessage.success('打包完成，关联采购单已推进至 packed')
    checkVisible.value = false
    await loadPack()
  } catch (e) {
    ElMessage.error('打包失败：' + (e as Error).message)
  } finally {
    packingId.value = null
  }
}

// ===== 6.8 跨境面单生成 =====
const channels = ref<{ code: string; name: string; currency: string; baseFee: number; perKgRate: number }[]>([])
const labelVisible = ref(false)
const labelStep = ref<'choose' | 'preview'>('choose')
const labelGen = ref(false)
const labelTaskId = ref<string | null>(null)
const labelForm = ref<{ channelCode: string }>({ channelCode: '' })
const labelData = ref<ShippingLabelDto | null>(null)

function channelName(code: string): string {
  return channels.value.find((c) => c.code === code)?.name ?? code
}

/** 打开面单对话框：已出单则直接预览，否则进入选渠道生成。 */
function openLabel(row: PackTaskDto): void {
  labelTaskId.value = row.id
  labelForm.value.channelCode = channels.value[0]?.code ?? ''
  if (row.channelCode) {
    labelStep.value = 'preview'
    labelData.value = null
    labelGen.value = true
    transferApi
      .getLabel(row.id)
      .then((d) => (labelData.value = d))
      .catch((e) => ElMessage.error('获取面单失败：' + (e as Error).message))
      .finally(() => (labelGen.value = false))
  } else {
    labelStep.value = 'choose'
    labelData.value = null
  }
  labelVisible.value = true
}

/** 生成跨境面单：选渠道 → 建单 + 出 ZPL/预览，回填打包任务。 */
async function generateLabel(): Promise<void> {
  if (!labelTaskId.value) return
  if (!labelForm.value.channelCode) {
    ElMessage.warning('请选择跨境渠道')
    return
  }
  labelGen.value = true
  try {
    const res = await transferApi.generateLabel(labelTaskId.value, { channelCode: labelForm.value.channelCode })
    labelData.value = res.label
    labelStep.value = 'preview'
    ElMessage.success('面单已生成（运单号 ' + (res.label.trackingNo ?? '') + '）')
    await loadPack()
  } catch (e) {
    ElMessage.error('生成面单失败：' + (e as Error).message)
  } finally {
    labelGen.value = false
  }
}

/** 打印面单（在新标签打开预览，由浏览器打印对话框处理）。 */
function printLabel(): void {
  if (labelData.value?.pdfUrl) window.open(labelData.value.pdfUrl, '_blank')
}

onMounted(() => {
  load()
  loadPack()
  transferApi
    .channels()
    .then((c) => (channels.value = c))
    .catch(() => undefined)
})
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
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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
.stat-ico.alt3 {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
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
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.count-pill.alt {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
}
.pack-sec {
  margin-top: 16px;
}
.po-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.po-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  font-size: 12px;
}
.diff-mini {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.d-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.d-chip.ok {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.12);
}
.d-chip.warn {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.14);
}
.d-chip.bad {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.12);
}
.task-sub {
  margin-top: 18px;
}
.section-subtitle {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-700);
  margin-bottom: 10px;
}
.sm {
  font-size: 12px;
}
.strong {
  font-weight: 600;
  color: var(--ink-900);
}
.check-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.check-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.check-head .mono {
  margin-left: 6px;
}
.check-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.check-table {
  margin-top: 4px;
}
.channel-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.label-choose {
  padding: 4px 0;
}
.lp-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.lp-img {
  display: block;
  width: 200px;
  height: 300px;
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  background: #fff;
}
.lp-zpl {
  margin-top: 12px;
}
.zpl {
  margin: 0;
  padding: 10px 12px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: var(--r-sm);
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
