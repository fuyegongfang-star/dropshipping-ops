<template>
  <div class="po">
    <PageHeader
      title="采购单管理"
      subtitle="货代中转仓作业流 · 采购 / 供应商发货登记 → 到货入库 → 打包 → 出库"
      icon="purchase"
      accent="violet"
    >
      <template #actions>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
        <el-button type="primary" @click="openCreate">
          <AppIcon name="plus" :size="15" class="btn-ico" />录入采购单
        </el-button>
      </template>
    </PageHeader>

    <div class="tip">
      <AppIcon name="info" :size="16" class="tip-ico" />
      <div class="tip-body">
        <strong>阶段6 · 中转仓作业流</strong>
        <p>
          采购单登记供应商发货信息（快递单号 / 物流公司 / 平台订单号 / 产品图），后续经「扫码到货入库 → 打包 → 出跨境面单 → 出库」
          闭环到正式跨境物流（任务 6.4–6.9 逐步落地）。此处状态机：待处理 → 已到货 → 已匹配 → 已打包 → 已出库。
        </p>
      </div>
    </div>

    <el-card>
      <template #header>
        <div class="card-head">
          <span class="section-title">采购单列表</span>
          <div class="filters">
            <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 150px" @change="load">
              <el-option label="待处理" value="pending" />
              <el-option label="已到货" value="arrived" />
              <el-option label="已匹配" value="matched" />
              <el-option label="已打包" value="packed" />
              <el-option label="已出库" value="outbound" />
            </el-select>
            <span class="count-pill">共 {{ orders.length }} 单</span>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" :data="orders" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="items">
              <div v-for="it in row.items" :key="it.id" class="item-row">
                <span v-if="it.imageUrl" class="item-img"><img :src="it.imageUrl" alt="产品图" /></span>
                <span class="item-name">{{ it.productName }}</span>
                <span class="item-meta">SKU：{{ it.skuId || '—' }}</span>
                <span class="item-meta">数量：{{ it.quantity }}</span>
                <span v-if="it.unitPrice != null" class="item-meta">单价：{{ money(it.unitPrice) }}</span>
              </div>
              <div v-if="row.remark" class="remark-block">
                <AppIcon name="info" :size="14" class="remark-ico" />
                <div>
                  <span class="remark-k">作业备注（货代分拣/打包/贴单）</span>
                  <p class="remark-v">{{ row.remark }}</p>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="快递单号 / 采购单号" min-width="180">
          <template #default="{ row }">
            <div class="mono">{{ row.trackingNo }}</div>
            <div v-if="row.purchaseNo" class="mono muted po-no" title="业务采购单号（可印成条码供扫码枪识别）">
              {{ row.purchaseNo }}
            </div>
            <div v-else class="muted">—</div>
          </template>
        </el-table-column>
        <el-table-column label="物流公司" width="120" prop="carrier" />
        <el-table-column label="平台订单号" min-width="150">
          <template #default="{ row }"><span class="muted">{{ row.platformOrderNo || '—' }}</span></template>
        </el-table-column>
        <el-table-column label="产品图" width="90">
          <template #default="{ row }">
            <span v-if="row.productImages && row.productImages.length" class="img-count">
              <AppIcon name="image" :size="14" /> {{ row.productImages.length }}
            </span>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="115">
          <template #default="{ row }"><span class="tag-soft" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</span></template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="165">
          <template #default="{ row }"><span class="muted">{{ fmt(row.createdAt) }}</span></template>
        </el-table-column>
        <el-table-column label="关联订单" min-width="140">
          <template #default="{ row }">
            <span v-if="row.orderId" class="linked">
              <AppIcon name="link" :size="13" /> 已关联
            </span>
            <span v-else class="muted">未关联</span>
            <el-button size="small" text type="primary" @click="openMatch(row)">匹配/关联</el-button>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="170">
          <template #default="{ row }">
            <el-tooltip v-if="row.remark" :content="row.remark" placement="top" :show-after="250">
              <span class="remark-chip"><AppIcon name="info" :size="12" />{{ row.remark }}</span>
            </el-tooltip>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" type="primary" plain :disabled="!nextStatus(row.status)" @click="advance(row)">
              推进：{{ nextStatus(row.status) ? statusLabel(nextStatus(row.status)!) : '已终态' }}
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <div class="app-empty">
            <span class="app-empty-ico"><AppIcon name="purchase" :size="26" /></span>
            <span class="app-empty-text">暂无采购单</span>
          </div>
        </template>
      </el-table>
    </el-card>

    <!-- 录入采购单对话框 -->
    <el-dialog v-model="createVisible" title="录入采购单" width="680px" @closed="resetCreate">
      <el-form :model="form" label-width="100px">
        <!-- 任务 6.10：录入即关联店铺订单（一步到位，免二次手动匹配） -->
        <el-form-item label="关联店铺订单">
          <el-select
            v-model="form.orderId"
            filterable
            remote
            reserve-keyword
            clearable
            :remote-method="searchOrders"
            :loading="orderLoading"
            placeholder="输入平台订单号 / 收件人搜索，选中即建立关联"
            style="width: 100%"
            @change="onPickOrder"
          >
            <el-option v-for="o in orderOptions" :key="o.id" :label="`${o.platformOrderNo} · ${o.recipientName || '无收件人'}`" :value="o.id">
              <div class="opt">
                <span class="mono">{{ o.platformOrderNo }}</span>
                <span class="opt-recipient">{{ o.recipientName || '无收件人' }}</span>
                <span class="opt-shop">{{ o.shopName || '—' }}</span>
                <span class="tag-soft" :class="orderTagClass(o.status)">{{ orderStatusLabel(o.status) }}</span>
                <span v-if="poCountOf(o.id)" class="opt-warn">已有 {{ poCountOf(o.id) }} 张采购单</span>
              </div>
            </el-option>
          </el-select>
          <div class="pick-hint">
            <template v-if="pickedOrder">
              <AppIcon name="link" :size="13" class="hint-ico" />
              已选 <b class="mono">{{ pickedOrder.platformOrderNo }}</b> · {{ pickedOrder.recipientName || '无收件人' }}，提交后自动建立「采购单 ↔ 店铺订单」关联并带出行项
            </template>
            <template v-else>
              可留空（后续在列表里手动匹配）。选单后自动带出平台订单号 / 收件人，避免单子多了手动关联对错单
            </template>
          </div>
        </el-form-item>

        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="快递单号" required>
              <el-input v-model="form.trackingNo" placeholder="供应商快递单号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="物流公司" required>
              <el-input v-model="form.carrier" placeholder="如：顺丰速运" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="平台订单号">
              <el-input v-model="form.platformOrderNo" :disabled="!!pickedOrder" :placeholder="pickedOrder ? '已由所选订单带出' : '留空则后续手动匹配'" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收件人姓名">
              <el-input v-model="form.recipientName" :disabled="!!pickedOrder" :placeholder="pickedOrder ? '已由所选订单带出' : '用于按收件人匹配'" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="采购链接">
              <el-input v-model="form.purchaseUrl" placeholder="货源链接（可选）" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="产品图">
          <div v-if="pulledImageCount > 0" class="pulled-tip">
            <AppIcon name="check" :size="13" />
            <span>
              已从关联店铺订单拉取 {{ pulledImageCount }} 张商品主图，可继续上传实拍图补充
            </span>
          </div>
          <ProductImageUploader v-model="form.productImages" />
        </el-form-item>

        <el-form-item label="作业备注">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="3"
            maxlength="300"
            show-word-limit
            placeholder="给货代仓库的分拣 / 打包 / 贴单注意事项：如易碎品加气泡膜、两件分两箱发、需贴电池标、赠品不放箱内……"
          />
          <div class="pick-hint">
            <AppIcon name="info" :size="13" class="hint-ico" />
            该备注会同步到中转仓看板、打包队列、核对弹窗与扫码结果，供仓库人员分拣装货时查看
          </div>
        </el-form-item>

        <el-divider content-position="left">采购行项</el-divider>
        <div v-for="(it, i) in form.items" :key="i" class="line-item">
          <el-select v-model="it.skuId" placeholder="SKU（可选）" clearable filterable style="width: 200px">
            <el-option v-for="s in skuOptions" :key="s.id" :label="s.code" :value="s.id" />
          </el-select>
          <el-input v-model="it.productName" placeholder="产品名称" style="width: 180px" />
          <el-input-number v-model="it.quantity" :min="1" :max="9999" />
          <el-input v-model.number="it.unitPrice" placeholder="单价" style="width: 110px" />
          <el-button size="small" text type="danger" @click="form.items.splice(i, 1)">
            <AppIcon name="close" :size="14" />
          </el-button>
        </div>
        <el-button size="small" @click="addItem">
          <AppIcon name="plus" :size="14" class="btn-ico" />添加行项
        </el-button>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">提交采购单</el-button>
      </template>
    </el-dialog>

    <!-- 匹配 / 关联店铺订单对话框（任务 6.4） -->
    <el-dialog v-model="matchVisible" title="匹配 / 关联店铺订单" width="620px">
      <template v-if="matchTarget">
        <el-descriptions :column="2" border size="small" class="mb">
          <el-descriptions-item label="快递单号"><span class="mono">{{ matchTarget.trackingNo }}</span></el-descriptions-item>
          <el-descriptions-item label="当前状态">{{ statusLabel(matchTarget.status) }}</el-descriptions-item>
          <el-descriptions-item label="平台订单号">{{ matchTarget.platformOrderNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="收件人">{{ matchTarget.recipientName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="已关联" :span="2">
            <span v-if="matchTarget.orderId" class="linked"><AppIcon name="link" :size="13" /> {{ matchTarget.orderId }}</span>
            <span v-else class="muted">未关联</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="match-head">
          <span class="section-title">候选店铺订单（按匹配强度）</span>
          <el-button size="small" type="primary" :loading="matching" @click="autoMatch">
            <AppIcon name="magic" :size="14" class="btn-ico" />一键自动匹配
          </el-button>
        </div>

        <div v-loading="matching" class="cands">
          <div v-if="!candidates.length" class="app-empty small">
            <span class="app-empty-text">暂无候选（平台单号 / 收件人 / SKU 均不匹配）</span>
          </div>
          <div v-for="c in candidates" :key="c.orderId" class="cand" :class="{ active: linkOrderId === c.orderId }" @click="linkOrderId = c.orderId">
            <div class="cand-top">
              <span class="mono">{{ c.platformOrderNo }}</span>
              <span class="tag-soft" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
            </div>
            <div class="cand-reasons">
              <span v-for="r in c.reasons" :key="r" class="reason">{{ r }}</span>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button v-if="matchTarget?.orderId" text type="danger" @click="unlink">解除关联</el-button>
        <el-button @click="matchVisible = false">关闭</el-button>
        <el-button type="success" :disabled="!linkOrderId" @click="manualLink">关联所选订单</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { purchaseOrderApi, type PurchaseOrder, type PurchaseOrderStatus, type PurchaseOrderCandidate } from '@/api/purchase-order'
import { catalogApi, type Sku } from '@/api/catalog'
import { ordersApi, ORDER_STATUS_LABELS, type Order } from '@/api/orders'
import { money } from '@/locales'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import ProductImageUploader from '@/components/ProductImageUploader.vue'

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  pending: '待处理',
  arrived: '已到货',
  matched: '已匹配',
  packed: '已打包',
  outbound: '已出库',
}
// 状态机（§6）：合法推进目标（与后端 STATUS_TRANSITIONS 一致）。
const STATUS_NEXT: Record<PurchaseOrderStatus, PurchaseOrderStatus | null> = {
  pending: 'arrived',
  arrived: 'matched',
  matched: 'packed',
  packed: 'outbound',
  outbound: null,
}
const STATUS_CLASS: Record<PurchaseOrderStatus, string> = {
  pending: 'tag-gray',
  arrived: 'tag-blue',
  matched: 'tag-green',
  packed: 'tag-orange',
  outbound: 'tag-violet',
}

const orders = ref<PurchaseOrder[]>([])
const loading = ref(false)
const statusFilter = ref<string>('')

const createVisible = ref(false)
const creating = ref(false)
const skuOptions = ref<Sku[]>([])
// 6.4 匹配 / 关联
const matchVisible = ref(false)
const matching = ref(false)
const matchTarget = ref<PurchaseOrder | null>(null)
const candidates = ref<PurchaseOrderCandidate[]>([])
const linkOrderId = ref<string>('')

// 6.11 关联订单后自动拉取的商品主图数量（仅用于界面提示）
const pulledImageCount = ref(0)

// 6.10 录入即关联店铺订单（选单器）
interface OrderOption {
  id: string
  platformOrderNo: string
  recipientName: string | null
  status: string
  shopId: string
  shopName: string | null
}
const orderOptions = ref<OrderOption[]>([])
const orderLoading = ref(false)
const pickedOrder = ref<OrderOption | null>(null)
/** 每个店铺订单已挂了几张采购单（提示「已有 N 张」，防重复录单时无感知） */
const poCountByOrder = ref<Record<string, number>>({})

const form = reactive<{
  orderId: string
  shopId: string
  trackingNo: string
  carrier: string
  platformOrderNo: string
  recipientName: string
  purchaseUrl: string
  productImages: string[]
  remark: string
  items: { skuId: string; productName: string; quantity: number; unitPrice?: number }[]
}>({
  orderId: '', shopId: '', trackingNo: '', carrier: '', platformOrderNo: '', recipientName: '',
  purchaseUrl: '', productImages: [], remark: '',
  items: [{ skuId: '', productName: '', quantity: 1, unitPrice: undefined }],
})

function statusLabel(s: string): string {
  return STATUS_LABELS[s as PurchaseOrderStatus] ?? s
}
function statusClass(s: string): string {
  return STATUS_CLASS[s as PurchaseOrderStatus] ?? 'tag-gray'
}
function nextStatus(s: string): PurchaseOrderStatus | null {
  return STATUS_NEXT[s as PurchaseOrderStatus] ?? null
}
function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    orders.value = await purchaseOrderApi.list({ status: statusFilter.value || undefined })
  } catch (e) {
    ElMessage.error('加载采购单失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function openCreate(): Promise<void> {
  createVisible.value = true
  orderLoading.value = true
  try {
    try {
      skuOptions.value = await catalogApi.skus()
    } catch {
      skuOptions.value = []
    }
    // 选单器：预载最近 50 单 + 统计每单已挂采购单数（提示重复关联）
    const [os, pos] = await Promise.all([
      ordersApi.search({ take: 50 }).catch(() => [] as Order[]),
      purchaseOrderApi.list().catch(() => [] as PurchaseOrder[]),
    ])
    orderOptions.value = os.map(toOrderOption)
    const counts: Record<string, number> = {}
    for (const po of pos) {
      if (po.orderId) counts[po.orderId] = (counts[po.orderId] ?? 0) + 1
    }
    poCountByOrder.value = counts
  } finally {
    orderLoading.value = false
  }
}

function toOrderOption(o: Order): OrderOption {
  return {
    id: o.id,
    platformOrderNo: o.platformOrderNo,
    recipientName: (o.recipient as { name?: string } | null)?.name ?? null,
    status: o.status,
    shopId: o.shopId,
    shopName: o.shop?.name ?? null,
  }
}

function orderStatusLabel(s: string): string {
  return ORDER_STATUS_LABELS[s] ?? s
}
function orderTagClass(s: string): string {
  if (['delivered', 'completed'].includes(s)) return 'tag-green'
  if (['approved', 'pushed', 'picked_up', 'in_transit', 'customs_clearing', 'out_for_delivery'].includes(s)) return 'tag-blue'
  if (['exception', 'rejected', 'pending_review'].includes(s)) return 'tag-orange'
  return 'tag-gray'
}
function poCountOf(orderId: string): number {
  return poCountByOrder.value[orderId] ?? 0
}

/** 远程搜索店铺订单（平台订单号 / 收件人），用于录入时选单关联。 */
async function searchOrders(keyword: string): Promise<void> {
  orderLoading.value = true
  try {
    const os = await ordersApi.search({ keyword: keyword?.trim() || undefined, take: 50 })
    const list = os.map(toOrderOption)
    // 保留当前已选中的那一项，避免搜索后下拉 label 变空
    if (pickedOrder.value && !list.some((x) => x.id === pickedOrder.value!.id)) {
      list.unshift(pickedOrder.value)
    }
    orderOptions.value = list
  } catch (e) {
    ElMessage.error('搜索订单失败：' + (e as Error).message)
  } finally {
    orderLoading.value = false
  }
}

/** 选中订单：带出平台单号 / 收件人，并按订单行项预填采购行（仅当行项全空时）。 */
async function onPickOrder(orderId: string): Promise<void> {
  if (!orderId) {
    pickedOrder.value = null
    return
  }
  const o = orderOptions.value.find((x) => x.id === orderId) ?? null
  pickedOrder.value = o
  if (!o) return
  form.shopId = o.shopId
  form.platformOrderNo = o.platformOrderNo
  form.recipientName = o.recipientName ?? ''
  if (poCountOf(o.id) > 0) {
    ElMessage.warning(`该订单已有 ${poCountOf(o.id)} 张采购单，请确认是补采或多供应商分单`)
  }
  try {
    const detail = await ordersApi.detail(o.id)
    const items = detail.items ?? []

    // 自动拉取该订单商品主图（任务 6.11）：货代收货/打包时可据此核对实物
    const imgs = items.map((it) => (it.imageUrl ?? '').trim()).filter(Boolean) as string[]
    if (imgs.length) {
      const merged = [...form.productImages]
      let added = 0
      for (const u of imgs) {
        if (!merged.includes(u)) {
          merged.push(u)
          added += 1
        }
      }
      form.productImages = merged
      pulledImageCount.value += added
      ElMessage.success(`已自动拉取关联订单的 ${added} 张商品主图`)
    }

    // 行项预填：仅在用户尚未填写行项时覆盖，避免冲掉已录入内容
    if (orderItemsBlank() && items.length) {
      // 订单行项有 skuId 直接用；演示态订单只带 sku.code，则按 code 反查内部 SKU
      const byCode = new Map(skuOptions.value.map((s) => [s.code, s.id]))
      const prefilled = items.map((it) => {
        const code = it.sku?.code ?? ''
        return {
          skuId: (it.skuId as string | null) ?? byCode.get(code) ?? '',
          productName: code,
          quantity: it.quantity,
          unitPrice: undefined as number | undefined,
        }
      })
      form.items = prefilled
      ElMessage.info(`已按订单行项预填 ${prefilled.length} 行，可按实际采购修改`)
    }
  } catch {
    // 预填 / 拉图失败不阻断录入
  }
}

function orderItemsBlank(): boolean {
  return form.items.every((it) => !it.productName.trim() && !it.skuId)
}

function addItem(): void {
  form.items.push({ skuId: '', productName: '', quantity: 1, unitPrice: undefined })
}
function resetCreate(): void {
  form.orderId = ''
  form.shopId = ''
  form.trackingNo = ''
  form.carrier = ''
  form.platformOrderNo = ''
  form.recipientName = ''
  form.purchaseUrl = ''
  form.productImages = []
  form.remark = ''
  form.items = [{ skuId: '', productName: '', quantity: 1, unitPrice: undefined }]
  pickedOrder.value = null
  pulledImageCount.value = 0
}

async function submitCreate(): Promise<void> {
  if (!form.trackingNo.trim() || !form.carrier.trim()) {
    ElMessage.warning('请填写快递单号与物流公司')
    return
  }
  const validItems = form.items.filter((it) => it.productName.trim())
  if (validItems.length === 0) {
    ElMessage.warning('请至少填写一个产品名称')
    return
  }
  creating.value = true
  try {
    const po = await purchaseOrderApi.create({
      trackingNo: form.trackingNo.trim(),
      carrier: form.carrier.trim(),
      // 选了店铺订单则一并提交 orderId/shopId，后端（或演示态）自动建立关联并回填单号/收件人
      orderId: form.orderId || undefined,
      shopId: form.orderId ? form.shopId || undefined : undefined,
      platformOrderNo: form.platformOrderNo.trim() || undefined,
      recipientName: form.recipientName.trim() || undefined,
      purchaseUrl: form.purchaseUrl.trim() || undefined,
      productImages: form.productImages.map((x) => x.trim()).filter(Boolean) as string[],
      remark: form.remark.trim() || undefined,
      items: validItems.map((it) => ({
        skuId: it.skuId || undefined,
        productName: it.productName.trim(),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    })
    const linkedNo = pickedOrder.value?.platformOrderNo
    orders.value = [po, ...orders.value]
    createVisible.value = false
    ElMessage.success(linkedNo ? `采购单已创建并关联订单 ${linkedNo}` : '采购单已创建')
    if (form.orderId) {
      poCountByOrder.value[form.orderId] = poCountOf(form.orderId) + 1
    }
  } catch (e) {
    ElMessage.error('创建失败：' + (e as Error).message)
  } finally {
    creating.value = false
  }
}

async function advance(row: PurchaseOrder): Promise<void> {
  const target = nextStatus(row.status)
  if (!target) return
  try {
    const updated = await purchaseOrderApi.updateStatus(row.id, target)
    Object.assign(row, updated)
    ElMessage.success(`已推进至「${statusLabel(target)}」`)
  } catch (e) {
    ElMessage.error('推进失败：' + (e as Error).message)
  }
}

// ===== 6.4 匹配 / 关联店铺订单 =====
// matchTarget 直接持有 orders 中的行对象引用，改动其 orderId 会同步刷新列表「关联订单」列。
async function openMatch(row: PurchaseOrder): Promise<void> {
  matchTarget.value = row
  linkOrderId.value = row.orderId || ''
  matchVisible.value = true
  matching.value = true
  try {
    candidates.value = await purchaseOrderApi.candidates(row.id)
  } catch (e) {
    candidates.value = []
    ElMessage.error('获取候选失败：' + (e as Error).message)
  } finally {
    matching.value = false
  }
}

async function autoMatch(): Promise<void> {
  if (!matchTarget.value) return
  matching.value = true
  try {
    const r = await purchaseOrderApi.autoMatch(matchTarget.value.id)
    ElMessage.success(r.message)
    matchTarget.value.orderId = r.orderId // 同步列表列
    linkOrderId.value = r.orderId || ''
    candidates.value = await purchaseOrderApi.candidates(matchTarget.value.id)
  } catch (e) {
    ElMessage.error('自动匹配失败：' + (e as Error).message)
  } finally {
    matching.value = false
  }
}

async function manualLink(): Promise<void> {
  if (!matchTarget.value || !linkOrderId.value) return
  try {
    const po = await purchaseOrderApi.link(matchTarget.value.id, linkOrderId.value)
    matchTarget.value.orderId = po.orderId // 同步列表列
    ElMessage.success('已关联店铺订单')
  } catch (e) {
    ElMessage.error('关联失败：' + (e as Error).message)
  }
}

async function unlink(): Promise<void> {
  if (!matchTarget.value) return
  try {
    await purchaseOrderApi.unlink(matchTarget.value.id)
    matchTarget.value.orderId = null // 同步列表列
    linkOrderId.value = ''
    ElMessage.success('已解除关联')
  } catch (e) {
    ElMessage.error('解除失败：' + (e as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
.btn-ico { margin-right: 5px; }
.card-head { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.card-head .section-title { margin: 0; }
.filters { display: flex; align-items: center; gap: 12px; }
.count-pill { font-size: 12px; font-weight: 600; color: #4f46e5; background: rgba(79, 70, 229, 0.12); padding: 4px 10px; border-radius: 999px; }
.tip { display: flex; align-items: flex-start; gap: 11px; padding: 14px 16px; margin-bottom: 16px; border-radius: var(--r-md); background: linear-gradient(90deg, rgba(79, 70, 229, 0.08), #f7fbff); border: 1px solid #eceafe; }
.tip-ico { color: #4f46e5; margin-top: 2px; }
.tip-body { font-size: 13px; color: var(--ink-700); line-height: 1.7; }
.tip-body strong { display: block; color: var(--ink-900); margin-bottom: 3px; }
.tip-body p { margin: 0; }
.mono { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 13px; }
.muted { color: var(--ink-500); }
.img-count { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-600); }
.po-no { font-size: 12px; margin-top: 2px; }
.tag-soft { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; border: 1px solid transparent; }
.tag-gray { color: #64748b; background: rgba(100, 116, 139, 0.12); }
.tag-blue { color: #2563eb; background: rgba(37, 99, 235, 0.12); }
.tag-green { color: #16a34a; background: rgba(22, 163, 74, 0.12); }
.tag-orange { color: #ea580c; background: rgba(234, 88, 12, 0.12); }
.tag-violet { color: #7c3aed; background: rgba(124, 58, 237, 0.12); }
.items { padding: 6px 12px; }
.item-row { display: flex; align-items: center; gap: 14px; padding: 6px 0; border-bottom: 1px dashed var(--line); }
.item-row:last-child { border-bottom: none; }
.item-img img { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; }
.item-name { font-weight: 500; color: var(--ink-800); }
.item-meta { font-size: 12px; color: var(--ink-500); }
/* 关联订单自动拉取主图后的提示条 */
.pulled-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 5px 9px;
  font-size: 12px;
  line-height: 1.5;
  color: #15803d;
  background: var(--green-soft, #dcfce7);
  border-radius: var(--r-sm);
}
.line-item { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

/* 6.10 录入即关联（选单器） */
.opt { display: flex; align-items: center; gap: 10px; }
.opt-recipient { color: var(--ink-700); }
.opt-shop { color: var(--ink-500); font-size: 12px; }
.opt-warn { margin-left: auto; font-size: 12px; font-weight: 600; color: #b45309; background: rgba(245, 158, 11, 0.16); padding: 1px 8px; border-radius: 999px; }
.pick-hint { display: flex; align-items: flex-start; gap: 5px; margin-top: 5px; font-size: 12px; line-height: 1.6; color: var(--ink-500); }
.pick-hint b { color: var(--ink-800); }
.hint-ico { margin-top: 2px; flex: none; color: #4f46e5; }

/* 备注（货代作业提示） */
.remark-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 2px 8px; border-radius: 6px; font-size: 12px; color: #b45309; background: rgba(245, 158, 11, 0.14); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.remark-block { display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; padding: 10px 12px; border-radius: var(--r-sm); background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.45); }
.remark-ico { margin-top: 2px; color: #b45309; flex: none; }
.remark-k { font-size: 12px; font-weight: 600; color: #b45309; }
.remark-v { margin: 3px 0 0; font-size: 13px; line-height: 1.6; color: var(--ink-800); white-space: pre-wrap; }
</style>
