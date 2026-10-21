<template>
  <div class="amazon">
    <PageHeader
      title="Amazon SP-API 对接"
      subtitle="FBA 头程入仓 · FBM 买运单 · 结算报表对账（方案 §29 完整对接）"
      icon="amazon"
      accent="orange"
    >
      <template #actions>
        <el-select v-model="shopId" class="shop-select" placeholder="选择 Amazon 店铺" @change="onShopChange">
          <el-option v-for="s in amazonShops" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-button :loading="checking" @click="checkHealth">
          <AppIcon name="refresh" :size="15" class="btn-ico" />连接检测
        </el-button>
      </template>
    </PageHeader>

    <!-- 连接健康条：真实后端会申请 LWA 令牌；演示态直接判定可达 -->
    <div v-if="health" class="health-bar" :class="health.healthy ? 'ok' : 'bad'">
      <AppIcon :name="health.healthy ? 'check' : 'warning'" :size="16" />
      <span class="hb-msg">{{ health.message }}</span>
      <span class="hb-latency">延迟 {{ health.latencyMs }}ms</span>
    </div>

    <el-alert
      class="note"
      type="info"
      :closable="false"
      title="演示说明"
      description="本页与后端 AmazonController 同口径。演示模式（mock）无需凭证即可走通 FBA 入库计划 / FBM 买运单 / 报表对账全链路；正式接入需在「渠道」配置真实 LWA + AWS SigV4 凭证（开发者账号审核通过后）。"
    />

    <el-tabs v-model="activeTab" class="amz-tabs">
      <!-- ① FBA 头程入仓 -->
      <el-tab-pane label="FBA 头程入仓" name="fba">
        <el-card>
          <template #header><span class="section-title">① 创建入库计划</span></template>
          <p class="hint">填写发货 SKU 与数量，Amazon 将分配目的 FBA 仓与 FNSKU（头程发货目的）。</p>
          <div v-for="(it, idx) in planItems" :key="idx" class="kv-row">
            <el-input v-model="it.sellerSku" placeholder="Seller SKU（如 SKU-A）" class="kv-sku" />
            <el-input-number v-model="it.quantity" :min="1" :max="9999" controls-position="right" class="kv-qty" />
            <el-button text type="danger" :icon="''" @click="removePlanItem(idx)">
              <AppIcon name="trash" :size="15" />
            </el-button>
          </div>
          <el-button class="add-btn" @click="addPlanItem"><AppIcon name="plus" :size="14" class="btn-ico" />添加 SKU</el-button>

          <div class="ship-from">
            <span class="sub-label">发货地址（头程起点）</span>
            <div class="addr-grid">
              <el-input v-model="shipFrom.name" placeholder="收件人名/公司" />
              <el-input v-model="shipFrom.addressLine1" placeholder="地址行 1" />
              <el-input v-model="shipFrom.city" placeholder="城市" />
              <el-input v-model="shipFrom.stateOrRegion" placeholder="州/省" />
              <el-input v-model="shipFrom.postalCode" placeholder="邮编" />
              <el-input v-model="shipFrom.countryCode" placeholder="国家码（US）" />
            </div>
            <el-select v-model="labelPrep" class="prep-select" placeholder="标签预处理偏好">
              <el-option label="卖家贴标（SELLER_LABEL）" value="SELLER_LABEL" />
              <el-option label="Amazon 贴标（AMAZON_LABEL）" value="AMAZON_LABEL" />
            </el-select>
          </div>

          <el-button type="primary" :loading="planLoading" @click="createPlan">
            <AppIcon name="warehouse" :size="15" class="btn-ico" />创建入库计划
          </el-button>
        </el-card>

        <el-card v-if="plans.length" class="res-card">
          <template #header><span class="section-title">入库计划结果</span></template>
          <el-table :data="plans" class="mb">
            <el-table-column label="计划 ID" prop="shipmentPlanId" min-width="150" />
            <el-table-column label="目的 FBA 仓" prop="destinationFulfillmentCenterId" width="150" />
            <el-table-column label="SKU / FNSKU / 数量" min-width="320">
              <template #default="{ row }">
                <div v-for="it in row.items" :key="it.sellerSku" class="plan-item">
                  <span class="tag-soft tag-violet">{{ it.sellerSku }}</span>
                  <span class="arrow-text">→{{ it.fulfillmentNetworkSku }}</span>
                  <span class="muted">×{{ it.quantity }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button size="small" type="primary" :loading="createLoading" @click="createShipment(row)">
                  创建货件
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card v-if="shipment" class="res-card">
          <template #header><span class="section-title">货件已创建（头程在途）</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="Shipment ID">{{ shipment.shipmentId }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <span class="tag-soft" :class="fbaStatusClass(shipment.status)">{{ shipment.status }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="目的 FBA 仓">{{ shipment.destinationFulfillmentCenterId }}</el-descriptions-item>
            <el-descriptions-item label="货件名">{{ shipment.shipmentName }}</el-descriptions-item>
          </el-descriptions>
          <el-button class="mt" :loading="queryLoading" @click="queryShipment(shipment.shipmentId)">
            查询货件状态
          </el-button>
        </el-card>

        <el-card class="res-card">
          <template #header><span class="section-title">预处理指引查询</span></template>
          <div class="kv-row">
            <el-input v-model="prepSkus" placeholder="SKU 列表，逗号分隔（如 SKU-A,SKU-B）" class="kv-sku" />
            <el-button :loading="prepLoading" @click="queryPrep"><AppIcon name="search" :size="15" class="btn-ico" />查询</el-button>
          </div>
          <el-table v-if="prepList.length" :data="prepList" class="mt">
            <el-table-column label="Seller SKU" prop="sellerSku" width="160" />
            <el-table-column label="预处理指引" prop="prepGuidance" width="220" />
            <el-table-column label="预处理方" prop="prepOwner" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- ② FBM 买运单 -->
      <el-tab-pane label="FBM 买运单" name="shipping">
        <el-card>
          <template #header><span class="section-title">② 购买末程面单（FBM 推单）</span></template>
          <p class="hint">FBM 自发货时，经 Amazon MerchantFulfillment 购面单并取追踪号，用于回写平台完成履约。</p>
          <el-input v-model="orderId" placeholder="Amazon 订单号（如 A1B2C3）" class="mb" />
          <div v-for="(it, idx) in shipItems" :key="idx" class="kv-row">
            <el-input v-model="it.sellerSku" placeholder="Seller SKU" class="kv-sku" />
            <el-input-number v-model="it.quantity" :min="1" :max="9999" controls-position="right" class="kv-qty" />
            <el-button text type="danger" @click="shipItems.splice(idx, 1)">
              <AppIcon name="trash" :size="15" />
            </el-button>
          </div>
          <el-button class="add-btn" @click="shipItems.push({ sellerSku: '', quantity: 1 })">
            <AppIcon name="plus" :size="14" class="btn-ico" />添加 SKU
          </el-button>
          <div class="block mt">
            <el-button type="primary" :loading="labelLoading" @click="buyLabel">
              <AppIcon name="print" :size="15" class="btn-ico" />购买运单
            </el-button>
          </div>
        </el-card>

        <el-card v-if="label" class="res-card">
          <template #header><span class="section-title">面单已购（追踪号）</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="Shipment ID">{{ label.shipmentId }}</el-descriptions-item>
            <el-descriptions-item label="追踪号">
              <span class="track-no">{{ label.trackingId }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="面单类型">{{ label.labelFileType }}</el-descriptions-item>
            <el-descriptions-item label="下载">
              <el-link type="primary" :href="label.downloadUrl" target="_blank">面单文件</el-link>
            </el-descriptions-item>
          </el-descriptions>
          <el-alert class="mt" type="success" :closable="false" :title="`追踪号 ${label.trackingId} 将回写 Amazon 完成 FBM 履约`" />
        </el-card>
      </el-tab-pane>

      <!-- ③ 结算报表对账 -->
      <el-tab-pane label="结算报表对账" name="reports">
        <el-card>
          <template #header><span class="section-title">③ 请求结算报表</span></template>
          <p class="hint">按报表类型创建报表（Reports 2021-06-30），异步处理完成后可下载并解析结算汇总。</p>
          <div class="kv-row">
            <el-select v-model="reportType" placeholder="报表类型" class="kv-sku">
              <el-option v-for="rt in reportTypes" :key="rt" :label="rt" :value="rt" />
            </el-select>
            <el-date-picker v-model="reportStart" type="date" placeholder="数据起始（可选）" value-format="YYYY-MM-DD" />
            <el-date-picker v-model="reportEnd" type="date" placeholder="数据结束（可选）" value-format="YYYY-MM-DD" />
            <el-button type="primary" :loading="reportLoading" @click="requestReport">
              <AppIcon name="chart" :size="15" class="btn-ico" />请求报表
            </el-button>
          </div>
        </el-card>

        <el-card v-if="report" class="res-card">
          <template #header><span class="section-title">报表状态（轮询）</span></template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="Report ID">{{ report.reportId }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <span class="tag-soft" :class="report.processingStatus === 'DONE' ? 'tag-green' : 'tag-orange'">
                {{ report.processingStatus }}
              </span>
            </el-descriptions-item>
          </el-descriptions>
          <el-button class="mt" :loading="reportLoading" @click="pollReport(report.reportId)">刷新状态</el-button>
          <el-button
            v-if="report.processingStatus === 'DONE'"
            type="primary"
            :loading="settleLoading"
            @click="loadSettlement(report.reportId)"
          >
            下载结算汇总
          </el-button>
        </el-card>

        <el-card v-if="settlement" class="res-card">
          <template #header><span class="section-title">结算汇总（{{ settlement.currency }}）</span></template>
          <div class="summary-cards">
            <div class="sc">
              <span class="sc-label">总入账</span>
              <span class="sc-value pos">+{{ money(settlement.totalAmount) }}</span>
            </div>
            <div class="sc">
              <span class="sc-label">总费用</span>
              <span class="sc-value neg">-{{ money(settlement.totalFee) }}</span>
            </div>
            <div class="sc">
              <span class="sc-label">净额</span>
              <span class="sc-value" :class="settlement.net >= 0 ? 'pos' : 'neg'">{{ money(settlement.net) }}</span>
            </div>
            <div class="sc">
              <span class="sc-label">交易笔数</span>
              <span class="sc-value">{{ settlement.transactionCount }}</span>
            </div>
          </div>
          <el-table :data="settlement.byType" class="mt">
            <el-table-column label="类型" prop="type" width="200" />
            <el-table-column label="金额" min-width="160">
              <template #default="{ row }">
                <span :class="row.amount >= 0 ? 'pos' : 'neg'">{{ row.amount >= 0 ? '+' : '' }}{{ money(row.amount) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { channelsApi, type Shop } from '@/api/channels'
import { amazonApi, AMAZON_REPORT_TYPES, type AmazonInboundShipmentPlan, type AmazonInboundShipment, type AmazonPrepInstruction, type AmazonShippingLabel, type AmazonReport, type AmazonSettlementSummary, type AmazonHealth } from '@/api/amazon'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// Amazon SP-API 对接可视化页（任务 5.3，方案 §29）：FBA 头程入仓 / FBM 买运单 / 结算报表对账。
const activeTab = ref<'fba' | 'shipping' | 'reports'>('fba')
const shops = ref<Shop[]>([])
const shopId = ref('')
const amazonShops = computed(() => shops.value.filter((s) => s.platform === 'amazon'))
const reportTypes = AMAZON_REPORT_TYPES

const health = ref<AmazonHealth | null>(null)
const checking = ref(false)

// FBA 表单
const planItems = ref<{ sellerSku: string; quantity: number }[]>([{ sellerSku: 'SKU-A', quantity: 10 }])
const shipFrom = ref({ name: 'My Company', addressLine1: '1 Seller St', city: 'Los Angeles', stateOrRegion: 'CA', postalCode: '90001', countryCode: 'US' })
const labelPrep = ref<'SELLER_LABEL' | 'AMAZON_LABEL'>('SELLER_LABEL')
const plans = ref<AmazonInboundShipmentPlan[]>([])
const shipment = ref<AmazonInboundShipment | null>(null)
const prepSkus = ref('SKU-A,SKU-B')
const prepList = ref<AmazonPrepInstruction[]>([])
const planLoading = ref(false)
const createLoading = ref(false)
const queryLoading = ref(false)
const prepLoading = ref(false)

// FBM 表单
const orderId = ref('A1B2C3')
const shipItems = ref<{ sellerSku: string; quantity: number }[]>([{ sellerSku: 'SKU-A', quantity: 1 }])
const label = ref<AmazonShippingLabel | null>(null)
const labelLoading = ref(false)

// 报表表单
const reportType = ref(AMAZON_REPORT_TYPES[0])
const reportStart = ref('')
const reportEnd = ref('')
const report = ref<AmazonReport | null>(null)
const settlement = ref<AmazonSettlementSummary | null>(null)
const reportLoading = ref(false)
const settleLoading = ref(false)

function money(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}
function fbaStatusClass(status: string): string {
  if (status === 'DELIVERED') return 'tag-green'
  if (status === 'IN_TRANSIT') return 'tag-orange'
  return 'tag-violet'
}
function addPlanItem(): void {
  planItems.value.push({ sellerSku: '', quantity: 1 })
}
function removePlanItem(idx: number): void {
  planItems.value.splice(idx, 1)
}

async function loadShops(): Promise<void> {
  try {
    shops.value = await channelsApi.shops()
    if (!shopId.value && amazonShops.value.length) shopId.value = amazonShops.value[0].id
  } catch {
    shops.value = []
  }
}
async function onShopChange(): Promise<void> {
  health.value = null
}
async function checkHealth(): Promise<void> {
  if (!shopId.value) {
    ElMessage.warning('请先选择 Amazon 店铺')
    return
  }
  checking.value = true
  try {
    health.value = await amazonApi.health(shopId.value)
  } catch (e) {
    ElMessage.error('连接检测失败：' + (e as Error).message)
  } finally {
    checking.value = false
  }
}

async function createPlan(): Promise<void> {
  if (!shopId.value) return void ElMessage.warning('请先选择 Amazon 店铺')
  const items = planItems.value.filter((i) => i.sellerSku.trim())
  if (!items.length) return void ElMessage.warning('至少添加一个有效 SKU')
  planLoading.value = true
  try {
    plans.value = await amazonApi.fbaPlan(shopId.value, { items, shipFromAddress: shipFrom.value, labelPrepPreference: labelPrep.value })
    shipment.value = null
    ElMessage.success(`入库计划已生成（目的仓 ${plans.value[0]?.destinationFulfillmentCenterId ?? ''}）`)
  } catch (e) {
    ElMessage.error('创建入库计划失败：' + (e as Error).message)
  } finally {
    planLoading.value = false
  }
}

async function createShipment(plan: AmazonInboundShipmentPlan): Promise<void> {
  if (!shopId.value) return
  createLoading.value = true
  try {
    shipment.value = await amazonApi.fbaCreate(shopId.value, { shipmentName: `入仓-${plan.destinationFulfillmentCenterId}`, plan, shipFromAddress: shipFrom.value })
    ElMessage.success(`货件 ${shipment.value.shipmentId} 已创建（${shipment.value.status}）`)
  } catch (e) {
    ElMessage.error('创建货件失败：' + (e as Error).message)
  } finally {
    createLoading.value = false
  }
}

async function queryShipment(shipmentId: string): Promise<void> {
  if (!shopId.value) return
  queryLoading.value = true
  try {
    shipment.value = await amazonApi.fbaGet(shopId.value, shipmentId)
    ElMessage.info(`状态：${shipment.value.status}`)
  } catch (e) {
    ElMessage.error('查询货件失败：' + (e as Error).message)
  } finally {
    queryLoading.value = false
  }
}

async function queryPrep(): Promise<void> {
  if (!shopId.value) return
  if (!prepSkus.value.trim()) return void ElMessage.warning('请输入 SKU')
  prepLoading.value = true
  try {
    prepList.value = await amazonApi.fbaPrep(shopId.value, prepSkus.value.trim())
  } catch (e) {
    ElMessage.error('查询预处理指引失败：' + (e as Error).message)
  } finally {
    prepLoading.value = false
  }
}

async function buyLabel(): Promise<void> {
  if (!shopId.value) return void ElMessage.warning('请先选择 Amazon 店铺')
  if (!orderId.value.trim()) return void ElMessage.warning('请输入 Amazon 订单号')
  const items = shipItems.value.filter((i) => i.sellerSku.trim())
  if (!items.length) return void ElMessage.warning('至少添加一个有效 SKU')
  labelLoading.value = true
  try {
    label.value = await amazonApi.shippingLabel(shopId.value, { amazonOrderId: orderId.value.trim(), items })
    ElMessage.success(`面单已购，追踪号 ${label.value.trackingId}`)
  } catch (e) {
    ElMessage.error('购买运单失败：' + (e as Error).message)
  } finally {
    labelLoading.value = false
  }
}

async function requestReport(): Promise<void> {
  if (!shopId.value) return void ElMessage.warning('请先选择 Amazon 店铺')
  reportLoading.value = true
  settlement.value = null
  try {
    report.value = await amazonApi.requestReport(shopId.value, {
      reportType: reportType.value,
      dataStartTime: reportStart.value || undefined,
      dataEndTime: reportEnd.value || undefined,
    })
    ElMessage.success(`报表已提交（${report.value.processingStatus}）`)
  } catch (e) {
    ElMessage.error('请求报表失败：' + (e as Error).message)
  } finally {
    reportLoading.value = false
  }
}

async function pollReport(id: string): Promise<void> {
  if (!shopId.value) return
  reportLoading.value = true
  try {
    report.value = await amazonApi.getReport(shopId.value, id)
    if (report.value.processingStatus === 'DONE') ElMessage.success('报表已就绪，可下载结算汇总')
    else ElMessage.info(`处理中（${report.value.processingStatus}），稍后再试`)
  } catch (e) {
    ElMessage.error('查询报表失败：' + (e as Error).message)
  } finally {
    reportLoading.value = false
  }
}

async function loadSettlement(docId: string): Promise<void> {
  if (!shopId.value) return
  settleLoading.value = true
  try {
    settlement.value = await amazonApi.settlement(shopId.value, docId)
    ElMessage.success('结算汇总已解析')
  } catch (e) {
    ElMessage.error('下载结算汇总失败：' + (e as Error).message)
  } finally {
    settleLoading.value = false
  }
}

onMounted(loadShops)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
}
.note {
  margin-bottom: 16px;
}
.shop-select {
  width: 220px;
}
.health-bar {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 16px;
  border-radius: var(--r-md);
  font-size: 13px;
  margin-bottom: 14px;
}
.health-bar.ok {
  background: var(--teal-soft);
  color: #0f766e;
  border: 1px solid #b8e6df;
}
.health-bar.bad {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}
.hb-latency {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.amz-tabs {
  margin-top: 4px;
}
.section-title {
  font-weight: 600;
  color: var(--ink-800);
}
.hint {
  font-size: 13px;
  color: var(--ink-600);
  margin: 0 0 14px;
}
.kv-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.kv-sku {
  flex: 1;
}
.kv-qty {
  width: 150px;
}
.add-btn {
  margin-bottom: 16px;
}
.ship-from {
  margin: 8px 0 16px;
  padding: 14px;
  border: 1px dashed var(--line);
  border-radius: var(--r-md);
}
.sub-label {
  display: block;
  font-size: 12px;
  color: var(--ink-500);
  margin-bottom: 8px;
}
.addr-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.prep-select {
  width: 280px;
}
.res-card {
  margin-top: 16px;
}
.mb {
  margin-bottom: 14px;
}
.mt {
  margin-top: 14px;
}
.plan-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.arrow-text {
  color: var(--brand-600);
  font-weight: 600;
}
.track-no {
  font-family: var(--font-mono, monospace);
  font-weight: 600;
  color: var(--brand-700);
}
.block {
  display: block;
}
.summary-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.sc {
  background: var(--surface-soft, #f7f9ff);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 14px;
  text-align: center;
}
.sc-label {
  display: block;
  font-size: 12px;
  color: var(--ink-500);
  margin-bottom: 6px;
}
.sc-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.pos {
  color: #0f766e;
}
.neg {
  color: #dc2626;
}
.tag-soft {
  display: inline-block;
  padding: 2px 9px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 600;
}
.tag-violet {
  background: #ede9fe;
  color: #6d28d9;
}
.tag-orange {
  background: #ffedd5;
  color: #c2410c;
}
.tag-green {
  background: #d1fae5;
  color: #047857;
}
.muted {
  color: var(--ink-400);
}
</style>
