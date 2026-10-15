<template>
  <div class="billing">
    <PageHeader
      title="商户账单与承运商对账"
      subtitle="§9/§10 基于 sell_price 出账、carrier_cost 对账，平台利润 = Σsell − Σcost"
      icon="bill"
      accent="brand"
    >
      <template #actions>
        <el-input v-model="period" placeholder="账期 YYYY-MM" class="period-input" size="default">
          <template #prefix><AppIcon name="calendar" :size="14" /></template>
        </el-input>
      </template>
    </PageHeader>

    <!-- 平台利润核算（§9 spread） -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-sell"><AppIcon name="arrow-down" :size="20" /></div>
          <div class="stat-label">应收合计（商户账单）</div>
          <div class="stat-value">{{ fmt(profit?.totalSell) }}</div>
          <div class="stat-sub">Σ sell_price</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-cost"><AppIcon name="arrow-up" :size="20" /></div>
          <div class="stat-label">应付合计（承运商对账）</div>
          <div class="stat-value">{{ fmt(profit?.totalCost) }}</div>
          <div class="stat-sub">Σ carrier_cost</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-profit" shadow="hover">
          <div class="stat-ico ico-profit"><AppIcon name="trend" :size="20" /></div>
          <div class="stat-label">平台利润</div>
          <div class="stat-value" :class="profit && profit.profit < 0 ? 'amt-neg' : 'amt-pos'">
            {{ fmt(profit?.profit) }}
          </div>
          <div class="stat-sub">应收 − 应付</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-margin"><AppIcon name="percent" :size="20" /></div>
          <div class="stat-label">毛利率</div>
          <div class="stat-value">{{ marginText }}</div>
          <div class="stat-sub">{{ profit ? profit.billCount : 0 }} 账单 · {{ profit ? profit.reconciliationCount : 0 }} 对账</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-loading="loading" class="main-card" shadow="never">
      <el-tabs v-model="activeTab" class="billing-tabs">
        <!-- 商户账单 -->
        <el-tab-pane label="商户账单" name="bills">
          <div class="toolbar">
            <span class="toolbar-hint">按账期聚合各租户 <b>sell_price</b>，生成后由草稿→出账→结清。</span>
            <el-button type="primary" :loading="busy" @click="onGenBills">
              <AppIcon name="plus" :size="14" class="btn-ico" />生成 {{ period }} 账单
            </el-button>
          </div>
          <el-table :data="bills" class="bill-table" empty-text="暂无账单，点击「生成账单」">
            <el-table-column label="账期" prop="period" width="110" />
            <el-table-column label="租户" prop="tenantId" min-width="120" />
            <el-table-column label="币种" prop="currency" width="80" />
            <el-table-column label="应收合计" width="140">
              <template #default="{ row }"><span class="amt amt-pos">{{ fmt(row.totalSell) }}</span></template>
            </el-table-column>
            <el-table-column label="单数" prop="itemCount" width="90" align="center" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="billTag(row.status)" size="small" effect="light">{{ billLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="180">
              <template #default="{ row }">
                <el-button size="small" type="warning" plain :disabled="row.status !== 'draft'" :loading="busy" @click="onIssue(row)">出账</el-button>
                <el-button size="small" type="success" plain :disabled="row.status !== 'issued'" :loading="busy" @click="onSettle(row)">结清</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 承运商对账 -->
        <el-tab-pane label="承运商对账" name="recons">
          <div class="toolbar">
            <span class="toolbar-hint">按账期聚合各承运商 <b>carrier_cost</b>，匹配后关闭完成对账。</span>
            <el-button type="primary" :loading="busy" @click="onGenRecons">
              <AppIcon name="plus" :size="14" class="btn-ico" />生成 {{ period }} 对账
            </el-button>
          </div>
          <el-table :data="recons" class="bill-table" empty-text="暂无对账，点击「生成对账」">
            <el-table-column label="账期" prop="period" width="110" />
            <el-table-column label="承运商" prop="carrierCode" min-width="130" />
            <el-table-column label="币种" prop="currency" width="80" />
            <el-table-column label="应付合计" width="140">
              <template #default="{ row }"><span class="amt amt-neg">{{ fmt(row.totalCost) }}</span></template>
            </el-table-column>
            <el-table-column label="单数" prop="itemCount" width="90" align="center" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="reconTag(row.status)" size="small" effect="light">{{ reconLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="180">
              <template #default="{ row }">
                <el-button size="small" type="warning" plain :disabled="row.status !== 'open'" :loading="busy" @click="onMatch(row)">匹配</el-button>
                <el-button size="small" type="success" plain :disabled="row.status === 'closed'" :loading="busy" @click="onClose(row)">关闭</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  billingApi,
  BILL_STATUS_LABELS,
  BILL_STATUS_TAG,
  RECON_STATUS_LABELS,
  RECON_STATUS_TAG,
  type BillItem,
  type ReconciliationItem,
  type ProfitSummary,
} from '@/api/billing'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 商户账单与承运商对账页（任务 4.2，方案 §9/§10/§16.4）。
const period = ref('2026-10')
const activeTab = ref('bills')
const bills = ref<BillItem[]>([])
const recons = ref<ReconciliationItem[]>([])
const profit = ref<ProfitSummary | null>(null)
const loading = ref(false)
const busy = ref(false)

function fmt(n?: number): string {
  return '¥' + (n ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const marginText = computed(() => {
  if (!profit.value) return '—'
  return (profit.value.marginRate * 100).toFixed(1) + '%'
})

// 状态收敛到受约束联合类型，避免窄索引报错（vue-tsc TS7053）
function billLabel(s: string): string {
  return BILL_STATUS_LABELS[s] ?? s
}
function billTag(s: string): 'info' | 'warning' | 'success' {
  return BILL_STATUS_TAG[s] ?? 'info'
}
function reconLabel(s: string): string {
  return RECON_STATUS_LABELS[s] ?? s
}
function reconTag(s: string): 'info' | 'warning' | 'success' {
  return RECON_STATUS_TAG[s] ?? 'info'
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [p, b, r] = await Promise.all([
      billingApi.getProfit(period.value),
      billingApi.listBills(),
      billingApi.listReconciliations(),
    ])
    profit.value = p
    bills.value = b
    recons.value = r
  } catch (e) {
    ElMessage.error('加载账单/对账失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function onGenBills(): Promise<void> {
  busy.value = true
  try {
    const res = await billingApi.generateBills(period.value)
    ElMessage.success(`生成账单 ${res.generated} 条、更新 ${res.updated} 条`)
    await refresh()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function onGenRecons(): Promise<void> {
  busy.value = true
  try {
    const res = await billingApi.generateReconciliations(period.value)
    ElMessage.success(`生成对账 ${res.generated} 条、更新 ${res.updated} 条`)
    await refresh()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function onIssue(row: BillItem): Promise<void> {
  busy.value = true
  try {
    await billingApi.issueBill(row.id)
    ElMessage.success('已出账')
    await refresh()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function onSettle(row: BillItem): Promise<void> {
  busy.value = true
  try {
    await billingApi.settleBill(row.id)
    ElMessage.success('已结清')
    await refresh()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function onMatch(row: ReconciliationItem): Promise<void> {
  busy.value = true
  try {
    await billingApi.matchReconciliation(row.id)
    ElMessage.success('已匹配')
    await refresh()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function onClose(row: ReconciliationItem): Promise<void> {
  busy.value = true
  try {
    await billingApi.closeReconciliation(row.id)
    ElMessage.success('已关闭对账')
    await refresh()
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.period-input {
  width: 150px;
}
.btn-ico {
  margin-right: 5px;
}
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: var(--r-lg);
  position: relative;
  overflow: hidden;
}
.stat-card :deep(.el-card__body) {
  padding: 18px 20px;
}
.stat-ico {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
  margin-bottom: 12px;
}
.ico-sell {
  background: linear-gradient(135deg, var(--teal-500), #0e9488);
  box-shadow: 0 6px 18px rgba(18, 181, 165, 0.32);
}
.ico-cost {
  background: linear-gradient(135deg, var(--red-500), #d63a3a);
  box-shadow: 0 6px 18px rgba(239, 68, 68, 0.3);
}
.ico-profit {
  background: linear-gradient(135deg, var(--violet-500), #5b3fe0);
  box-shadow: 0 6px 18px rgba(124, 92, 252, 0.32);
}
.ico-margin {
  background: linear-gradient(135deg, var(--amber-500), #e07b07);
  box-shadow: 0 6px 18px rgba(247, 144, 9, 0.3);
}
.stat-label {
  font-size: 13px;
  color: var(--ink-500);
  font-weight: 500;
}
.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--ink-900);
  letter-spacing: -0.5px;
  margin: 4px 0 2px;
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.stat-profit .stat-value.amt-pos {
  color: var(--green-500);
}
.stat-profit .stat-value.amt-neg {
  color: var(--red-500);
}
.main-card {
  border-radius: var(--r-lg);
}
.billing-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.toolbar-hint {
  font-size: 13px;
  color: var(--ink-500);
}
.toolbar-hint b {
  color: var(--brand-600);
}
.bill-table :deep(.el-tag) {
  font-weight: 600;
}
.amt {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.amt-pos {
  color: var(--green-500);
}
.amt-neg {
  color: var(--red-500);
}
</style>
