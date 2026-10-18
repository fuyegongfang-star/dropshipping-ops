<template>
  <div class="claims">
    <PageHeader
      title="理赔保险"
      subtitle="§20 异常理赔：丢件/破损/延误/清关失败/拒收/地址错误；承运商责任由平台代索赔，平台责任由平台赔付"
      icon="claim"
      accent="brand"
    >
      <template #actions>
        <el-button type="primary" @click="openNew">
          <AppIcon name="plus" :size="15" /> 新建理赔
        </el-button>
      </template>
    </PageHeader>

    <!-- 概览指标 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-total"><AppIcon name="claim" :size="20" /></div>
          <div class="stat-label">理赔总数</div>
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-sub">当前租户全部理赔单</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-open"><AppIcon name="clock" :size="20" /></div>
          <div class="stat-label">待处理</div>
          <div class="stat-value">{{ stats.open }}</div>
          <div class="stat-sub">未进入处理流程</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-proc"><AppIcon name="refresh" :size="20" /></div>
          <div class="stat-label">处理中</div>
          <div class="stat-value">{{ stats.processing }}</div>
          <div class="stat-sub">承运商 / 保险核实中</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-paid" shadow="hover">
          <div class="stat-ico ico-paid"><AppIcon name="check" :size="20" /></div>
          <div class="stat-label">已赔付</div>
          <div class="stat-value">{{ stats.paid }}</div>
          <div class="stat-sub">已结案赔付金额 ¥{{ fmt(stats.paidAmount) }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选 + 列表 -->
    <el-card v-loading="loading" class="list-card" shadow="never">
      <div class="toolbar">
        <div class="filters">
          <el-select v-model="filterStatus" placeholder="全部状态" clearable class="f-sel" @change="refresh">
            <el-option v-for="s in STATUS_LIST" :key="s" :label="CLAIM_STATUS_LABELS[s]" :value="s" />
          </el-select>
          <el-select v-model="filterType" placeholder="全部类型" clearable class="f-sel" @change="refresh">
            <el-option v-for="t in TYPE_LIST" :key="t" :label="CLAIM_TYPE_LABELS[t]" :value="t" />
          </el-select>
        </div>
        <el-button text @click="refresh"><AppIcon name="refresh" :size="15" /> 刷新</el-button>
      </div>

      <el-table :data="rows" class="claim-table" empty-text="暂无理赔单" row-key="id">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand">
              <div class="ex-row"><span class="ex-k">异常原因</span><span class="ex-v">{{ row.cause || '—' }}</span></div>
              <div class="ex-row"><span class="ex-k">处理备注</span><span class="ex-v">{{ row.note || '—' }}</span></div>
              <div class="ex-row">
                <span class="ex-k">承运商理赔号</span>
                <span class="ex-v mono">{{ row.refCarrierClaimId || '—' }}</span>
              </div>
              <div class="ex-row"><span class="ex-k">更新时间</span><span class="ex-v">{{ fmtTime(row.updatedAt) }}</span></div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="理赔单号" prop="id" min-width="150" class="mono" />
        <el-table-column label="运单号" prop="shipmentId" min-width="140">
          <template #default="{ row }"><span class="mono">{{ row.shipmentId }}</span></template>
        </el-table-column>
        <el-table-column label="异常类型" width="110">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.type)" size="small" effect="light">{{ typeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="责任方" width="100">
          <template #default="{ row }">
            <span v-if="row.responsibleParty">{{ partyLabel(row.responsibleParty) }}</span>
            <span v-else class="muted">待定</span>
          </template>
        </el-table-column>
        <el-table-column label="理赔金额" width="130">
          <template #default="{ row }">
            <span v-if="row.amount != null" class="amt">{{ fmt(row.amount) }}</span>
            <span v-else class="muted">未核定</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)" size="small" effect="dark">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }"><span class="muted">{{ fmtTime(row.createdAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="nextStatus(row.status).length"
              type="primary"
              link
              size="small"
              @click="openAdvance(row)"
            >推进</el-button>
            <span v-else class="muted">终态</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新建理赔 -->
    <el-dialog v-model="newVisible" title="新建理赔" width="480px" @closed="resetNew">
      <el-form :model="newForm" label-width="96px">
        <el-form-item label="运单号" required>
          <el-input v-model="newForm.shipmentId" placeholder="如 sh_2026xxxx" />
        </el-form-item>
        <el-form-item label="异常类型" required>
          <el-select v-model="newForm.type" placeholder="请选择" class="full">
            <el-option v-for="t in TYPE_LIST" :key="t" :label="CLAIM_TYPE_LABELS[t]" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="责任方">
          <el-select v-model="newForm.responsibleParty" placeholder="暂不指定" clearable class="full">
            <el-option v-for="p in PARTY_LIST" :key="p" :label="CLAIM_PARTY_LABELS[p]" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="理赔金额">
          <el-input-number v-model="newForm.amount" :min="0" :precision="2" :step="10" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="承运商理赔号">
          <el-input v-model="newForm.refCarrierClaimId" placeholder="如 DHL-CLM-xxxx（承运商反馈后回填）" />
        </el-form-item>
        <el-form-item label="异常原因">
          <el-input v-model="newForm.cause" type="textarea" :rows="2" placeholder="简述异常经过" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="newVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmNew">提交</el-button>
      </template>
    </el-dialog>

    <!-- 推进状态 -->
    <el-dialog v-model="advVisible" title="推进理赔状态" width="440px">
      <div v-if="advRow" class="adv-head">
        <div>理赔单 <span class="mono">{{ advRow.id }}</span> · 当前
          <el-tag :type="CLAIM_STATUS_TAG[advRow.status]" size="small" effect="dark">{{ CLAIM_STATUS_LABELS[advRow.status] }}</el-tag>
        </div>
      </div>
      <el-form :model="advForm" label-width="80px">
        <el-form-item label="目标状态" required>
          <el-select v-model="advForm.status" placeholder="请选择" class="full">
            <el-option
              v-for="s in CLAIM_NEXT_STATUS[advRow?.status || 'paid']"
              :key="s"
              :label="CLAIM_STATUS_LABELS[s]"
              :value="s"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="advForm.note" type="textarea" :rows="2" placeholder="如：承运商已赔付并冲减对账" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="advVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmAdvance">确认推进</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  claimsApi,
  type ClaimOut,
  type ClaimType,
  type ClaimStatus,
  type ClaimResponsibleParty,
  CLAIM_TYPE_LABELS,
  CLAIM_TYPE_TAG,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_TAG,
  CLAIM_PARTY_LABELS,
  CLAIM_NEXT_STATUS,
} from '@/api/claims'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 理赔保险页（任务 4.8，方案 §20）：列表 + 概览 + 新建 + 状态推进；演示/正式双路通。

const TYPE_LIST: ClaimType[] = ['lost', 'damage', 'delay', 'customs_fail', 'reject', 'address_error']
const STATUS_LIST: ClaimStatus[] = ['open', 'processing', 'approved', 'rejected', 'paid']
const PARTY_LIST: ClaimResponsibleParty[] = ['carrier', 'platform', 'insurer']

// 模板里 el-table 的 row 为 any，索引字面量联合类型的 Record 会触发 TS7053；
// 故在脚本侧提供带类型的取值函数，模板只调用函数（any → 形参类型安全）。
function typeLabel(t: ClaimType): string {
  return CLAIM_TYPE_LABELS[t]
}
function typeTag(t: ClaimType): 'danger' | 'warning' | 'info' {
  return CLAIM_TYPE_TAG[t]
}
function statusLabel(s: ClaimStatus): string {
  return CLAIM_STATUS_LABELS[s]
}
function statusTag(s: ClaimStatus): 'info' | 'warning' | 'success' | 'danger' | 'primary' {
  return CLAIM_STATUS_TAG[s]
}
function partyLabel(p: ClaimResponsibleParty | null | undefined): string {
  return p ? CLAIM_PARTY_LABELS[p] : '待定'
}
function nextStatus(s: ClaimStatus): ClaimStatus[] {
  return CLAIM_NEXT_STATUS[s]
}

const rows = ref<ClaimOut[]>([])
const loading = ref(false)
const filterStatus = ref('')
const filterType = ref('')

const stats = computed(() => {
  const list = rows.value
  const open = list.filter((c) => c.status === 'open').length
  const processing = list.filter((c) => c.status === 'processing').length
  const paid = list.filter((c) => c.status === 'paid').length
  const paidAmount = list.filter((c) => c.status === 'paid').reduce((s, c) => s + (c.amount ?? 0), 0)
  return { total: list.length, open, processing, paid, paidAmount }
})

function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    rows.value = await claimsApi.list(
      filterStatus.value || undefined,
      filterType.value || undefined,
    )
  } catch (e) {
    console.warn('[Claims] 加载失败', (e as Error).message)
    ElMessage.error('理赔列表加载失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

// ---- 新建理赔 ----
const newVisible = ref(false)
const saving = ref(false)
const newForm = reactive<{ shipmentId: string; type: ClaimType | ''; responsibleParty: ClaimResponsibleParty | ''; amount: number | null; refCarrierClaimId: string; cause: string }>({
  shipmentId: '',
  type: '',
  responsibleParty: '',
  amount: null,
  refCarrierClaimId: '',
  cause: '',
})

function openNew(): void {
  newVisible.value = true
}
function resetNew(): void {
  newForm.shipmentId = ''
  newForm.type = ''
  newForm.responsibleParty = ''
  newForm.amount = null
  newForm.refCarrierClaimId = ''
  newForm.cause = ''
}
async function confirmNew(): Promise<void> {
  if (!newForm.shipmentId.trim()) {
    ElMessage.warning('请填写运单号')
    return
  }
  if (!newForm.type) {
    ElMessage.warning('请选择异常类型')
    return
  }
  saving.value = true
  try {
    await claimsApi.create({
      shipmentId: newForm.shipmentId.trim(),
      type: newForm.type as ClaimType,
      cause: newForm.cause.trim() || undefined,
      amount: newForm.amount != null ? String(newForm.amount) : undefined,
      responsibleParty: newForm.responsibleParty || undefined,
      refCarrierClaimId: newForm.refCarrierClaimId.trim() || undefined,
    })
    ElMessage.success('理赔单已创建（状态：待处理）')
    newVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error('创建失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

// ---- 推进状态 ----
const advVisible = ref(false)
const advRow = ref<ClaimOut | null>(null)
const advForm = reactive<{ status: ClaimStatus | ''; note: string }>({ status: '', note: '' })

function openAdvance(row: ClaimOut): void {
  advRow.value = row
  const next = CLAIM_NEXT_STATUS[row.status]
  advForm.status = next.length ? next[0] : ''
  advForm.note = ''
  advVisible.value = true
}
async function confirmAdvance(): Promise<void> {
  if (!advRow.value) return
  if (!advForm.status) {
    ElMessage.warning('请选择目标状态')
    return
  }
  saving.value = true
  try {
    await claimsApi.updateStatus(advRow.value.id, { status: advForm.status as ClaimStatus, note: advForm.note.trim() || undefined })
    ElMessage.success(`已推进至「${CLAIM_STATUS_LABELS[advForm.status as ClaimStatus]}」`)
    advVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error('推进失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  refresh()
})
</script>

<style scoped>
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
.ico-total {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
}
.ico-open {
  background: linear-gradient(135deg, var(--teal-500), #0e9488);
  box-shadow: 0 6px 18px rgba(18, 181, 165, 0.32);
}
.ico-proc {
  background: linear-gradient(135deg, var(--amber-500), #e07b07);
  box-shadow: 0 6px 18px rgba(247, 144, 9, 0.3);
}
.ico-paid {
  background: linear-gradient(135deg, var(--green-500), #10a96b);
  box-shadow: 0 6px 18px rgba(16, 169, 107, 0.3);
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
.list-card {
  border-radius: var(--r-lg);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.filters {
  display: flex;
  gap: 12px;
}
.f-sel {
  width: 150px;
}
.claim-table :deep(.el-tag) {
  font-weight: 600;
}
.mono {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-variant-numeric: tabular-nums;
}
.amt {
  font-weight: 700;
  color: var(--ink-900);
}
.muted {
  color: var(--ink-400);
}
.expand {
  padding: 6px 28px;
}
.ex-row {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 13px;
}
.ex-k {
  width: 96px;
  color: var(--ink-500);
  flex: none;
}
.ex-v {
  color: var(--ink-800);
}
.full {
  width: 100%;
}
.adv-head {
  margin-bottom: 14px;
  font-size: 13px;
  color: var(--ink-600);
}
</style>
