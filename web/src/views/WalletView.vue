<template>
  <div class="wallet">
    <PageHeader
      title="收款账务 · 钱包"
      subtitle="预充值 / 信用账期 · 复式记账全链路（充值→冻结→扣费→退款→结算）"
      icon="wallet"
      accent="brand"
    >
      <template #actions>
        <span class="cur-pill"><AppIcon name="coins" :size="13" />结算币种 {{ wallet?.currency || 'CNY' }}</span>
      </template>
    </PageHeader>

    <!-- 钱包四宫格：可用额度 / 可用余额 / 冻结 / 授信 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card stat-available" shadow="hover">
          <div class="stat-ico"><AppIcon name="wallet" :size="20" /></div>
          <div class="stat-label">可用额度</div>
          <div class="stat-value">{{ fmt(wallet?.available) }}</div>
          <div class="stat-sub">= 余额 − 冻结 + 授信</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-balance"><AppIcon name="coins" :size="20" /></div>
          <div class="stat-label">可用余额</div>
          <div class="stat-value">{{ fmt(wallet?.balance) }}</div>
          <div class="stat-sub">充值累计 − 实际扣费</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-frozen"><AppIcon name="clock" :size="20" /></div>
          <div class="stat-label">冻结金额</div>
          <div class="stat-value">{{ fmt(wallet?.frozen) }}</div>
          <div class="stat-sub">在途订单锁价</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-credit"><AppIcon name="shield" :size="20" /></div>
          <div class="stat-label">信用账期授信</div>
          <div class="stat-value">{{ fmt(wallet?.creditLimit) }}</div>
          <div class="stat-sub">月结额度（credit）</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：资金操作 -->
      <el-col :span="10">
        <el-card v-loading="loading" class="ops-card">
          <template #header><span class="section-title">资金操作</span></template>

          <el-form label-position="top">
            <div class="op-block">
              <div class="op-title"><AppIcon name="plus" :size="15" /> 充值（预充值钱包）</div>
              <el-input-number v-model="rechargeAmt" :min="1" :step="100" class="w-full" />
              <el-button type="primary" class="w-full op-btn" :loading="busy" @click="onRecharge">
                确认充值
              </el-button>
            </div>

            <el-divider />

            <div class="op-block">
              <div class="op-title"><AppIcon name="shield" :size="15" /> 信用账期授信额度</div>
              <el-input-number v-model="creditAmt" :min="0" :step="1000" class="w-full" />
              <el-button type="warning" plain class="w-full op-btn" :loading="busy" @click="onSetCredit">
                设置授信
              </el-button>
            </div>
          </el-form>

          <el-divider>模拟订单资金流（一键演示）</el-divider>
          <p class="text-hint sim-hint">
            演示「下单锁价 → 履约扣费」与「撤单退款」的完整复式记账，便于直观验证账务口径。
          </p>
          <el-button class="w-full sim-btn" :loading="busy" @click="onSimulateOrder">
            <AppIcon name="bolt" :size="15" class="btn-ico" />模拟下单冻结 → 履约扣费
          </el-button>
          <el-button class="w-full sim-btn" :loading="busy" @click="onSimulateRefund">
            <AppIcon name="refresh" :size="15" class="btn-ico" />模拟撤单解冻 → 退款
          </el-button>
        </el-card>
      </el-col>

      <!-- 右：记账流水 -->
      <el-col :span="14">
        <el-card class="ledger-card">
          <template #header>
            <div class="card-head">
              <span class="section-title">复式记账流水</span>
              <span class="count-pill">{{ ledger.length }} 条</span>
            </div>
          </template>

          <el-table :data="ledger" class="ledger-table" empty-text="暂无记账记录">
            <el-table-column label="类型" width="92">
              <template #default="{ row }">
                <el-tag :type="ledgerTag(row.type)" size="small" effect="light">
                  {{ ledgerLabel(row.type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="金额" width="120">
              <template #default="{ row }">
                <span :class="['amt', row.amount > 0 ? 'amt-pos' : row.amount < 0 ? 'amt-neg' : 'amt-zero']">
                  {{ row.amount > 0 ? '+' : '' }}{{ fmt(row.amount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="变动后余额" width="120">
              <template #default="{ row }">{{ fmt(row.balanceAfter) }}</template>
            </el-table-column>
            <el-table-column label="关联" min-width="120">
              <template #default="{ row }">
                <span v-if="row.refType" class="ref-tag">{{ row.refType }}</span>
                <span class="ref-id">{{ row.refId || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="备注" prop="remark" min-width="120" show-overflow-tooltip />
            <el-table-column label="时间" width="160">
              <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { financeApi, LEDGER_LABELS, type WalletSummary, type LedgerItem, type LedgerType } from '@/api/finance'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 收款账务页（任务 4.1，方案 §16）：钱包四宫格 + 资金操作 + 复式记账流水。
const wallet = ref<WalletSummary | null>(null)
const ledger = ref<LedgerItem[]>([])
const loading = ref(false)
const busy = ref(false)

const rechargeAmt = ref(2000)
const creditAmt = ref(5000)

// 记账类型 → 标签配色（与主题令牌一致）
const TAG_TYPE: Record<string, 'success' | 'warning' | 'info' | 'danger' | 'primary'> = {
  recharge: 'success',
  refund: 'success',
  freeze: 'warning',
  unfreeze: 'info',
  charge: 'danger',
  settle: 'primary',
}

function fmt(n?: number): string {
  return '¥' + (n ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 表格行 type 为 any，经辅助函数收敛到受约束的联合类型，避免窄索引报错
function ledgerLabel(type: string): string {
  return LEDGER_LABELS[type as LedgerType] ?? type
}
function ledgerTag(type: string): 'success' | 'warning' | 'info' | 'danger' | 'primary' {
  return TAG_TYPE[type] ?? 'info'
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [w, l] = await Promise.all([financeApi.getWallet(), financeApi.getLedger()])
    wallet.value = w
    ledger.value = l
  } catch (e) {
    ElMessage.error('加载账务失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function onRecharge(): Promise<void> {
  busy.value = true
  try {
    wallet.value = await financeApi.recharge(rechargeAmt.value)
    ledger.value = await financeApi.getLedger()
    ElMessage.success(`已充值 ${fmt(rechargeAmt.value)}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

async function onSetCredit(): Promise<void> {
  busy.value = true
  try {
    wallet.value = await financeApi.setCreditLimit(creditAmt.value)
    ElMessage.success(`授信额度已设为 ${fmt(creditAmt.value)}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

// 模拟：下单锁价（冻结）→ 履约扣费；金额随机以体现真实变动
async function onSimulateOrder(): Promise<void> {
  busy.value = true
  const refId = 'SO' + Date.now().toString().slice(-6)
  const amt = 80 + Math.floor(Math.random() * 320)
  try {
    await financeApi.freeze(amt, refId)
    wallet.value = await financeApi.charge(amt, refId)
    ledger.value = await financeApi.getLedger()
    ElMessage.success(`订单 ${refId} 锁价 ¥${amt} 并扣费成功`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

// 模拟：撤单解冻 → 退款
async function onSimulateRefund(): Promise<void> {
  busy.value = true
  const refId = 'SO' + Date.now().toString().slice(-6)
  const amt = 60 + Math.floor(Math.random() * 240)
  try {
    await financeApi.unfreeze(amt, refId)
    wallet.value = await financeApi.refund(amt, refId)
    ledger.value = await financeApi.getLedger()
    ElMessage.success(`订单 ${refId} 撤单解冻并退款 ¥${amt}`)
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    busy.value = false
  }
}

onMounted(refresh)
</script>

<style scoped>
.w-full {
  width: 100%;
}
.btn-ico {
  margin-right: 5px;
}
.cur-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink-600);
  font-size: 13px;
  font-weight: 500;
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
.ico-balance {
  background: linear-gradient(135deg, var(--teal-500), #0e9488);
  box-shadow: 0 6px 18px rgba(18, 181, 165, 0.32);
}
.ico-frozen {
  background: linear-gradient(135deg, var(--amber-500), #e07b07);
  box-shadow: 0 6px 18px rgba(247, 144, 9, 0.3);
}
.ico-credit {
  background: linear-gradient(135deg, var(--violet-500), #5b3fe0);
  box-shadow: 0 6px 18px rgba(124, 92, 252, 0.32);
}
.stat-label {
  font-size: 13px;
  color: var(--ink-500);
  font-weight: 500;
}
.stat-value {
  font-size: 26px;
  font-weight: 800;
  color: var(--ink-900);
  letter-spacing: -0.5px;
  margin: 4px 0 2px;
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.stat-available .stat-value {
  color: var(--brand-600);
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.ops-card :deep(.el-card__body) {
  padding: 18px 20px;
}
.op-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.op-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-700);
}
.op-btn {
  margin-top: 2px;
}
.sim-hint {
  margin: 0 0 12px;
}
.sim-btn {
  margin-bottom: 10px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.count-pill {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}
.ledger-table :deep(.el-tag) {
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
.amt-zero {
  color: var(--ink-400);
}
.ref-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-soft);
  border-radius: 6px;
  padding: 1px 7px;
  margin-right: 6px;
}
.ref-id {
  color: var(--ink-500);
  font-size: 12px;
}
</style>
