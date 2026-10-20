<template>
  <div class="risk">
    <PageHeader
      title="风控中心"
      subtitle="§26 风控体系：规则引擎 + 评分，覆盖欺诈/刷单、黑名单、敏感货瞒报；高风险转人工审核"
      icon="risk"
      accent="brand"
    />

    <!-- 概览指标 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-scan"><AppIcon name="risk" :size="20" /></div>
          <div class="stat-label">扫描订单</div>
          <div class="stat-value">{{ summary.scanned }}</div>
          <div class="stat-sub">已接入风险评分的订单</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-high"><AppIcon name="warning" :size="20" /></div>
          <div class="stat-label">高风险</div>
          <div class="stat-value">{{ summary.highRisk }}</div>
          <div class="stat-sub">需重点关注（含黑名单命中）</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-pending"><AppIcon name="clock" :size="20" /></div>
          <div class="stat-label">待人工审核</div>
          <div class="stat-value">{{ summary.pendingReview }}</div>
          <div class="stat-sub">高风险转人工（结合 §13 待审）</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-bl"><AppIcon name="shield" :size="20" /></div>
          <div class="stat-label">黑名单条目</div>
          <div class="stat-value">{{ summary.blacklistCount }}</div>
          <div class="stat-sub">地址 / 买家 / 支付</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 三大区：风险订单 / 规则引擎 / 黑名单 -->
    <el-tabs v-model="tab" class="risk-tabs">
      <!-- 风险订单 -->
      <el-tab-pane label="风险订单" name="orders">
        <el-card v-loading="loadingOrders" class="list-card" shadow="never">
          <el-table :data="orders" class="risk-table" empty-text="暂无风险订单" row-key="id">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="expand">
                  <div class="ex-row"><span class="ex-k">命中规则</span>
                    <span class="ex-v">
                      <el-tag v-for="h in row.hits" :key="h.ruleId" :type="categoryTag(h.category)" size="small" effect="light" class="hit-tag">
                        {{ h.ruleName }} +{{ h.scoreDelta }}
                      </el-tag>
                    </span>
                  </div>
                  <div v-for="h in row.hits" :key="h.ruleId" class="ex-row">
                    <span class="ex-k">{{ h.ruleName }}</span>
                    <span class="ex-v">{{ h.detail }}</span>
                  </div>
                  <div class="ex-row"><span class="ex-k">审核</span>
                    <span class="ex-v">{{ reviewStatusLabel(row.reviewStatus) }}
                      <span v-if="row.reviewNote" class="review-note">（{{ row.reviewNote }}）</span>
                    </span>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="平台单号" prop="platformOrderNo" min-width="130" />
            <el-table-column label="收件人" prop="recipientName" min-width="120" />
            <el-table-column label="国家" prop="country" width="80" />
            <el-table-column label="金额" width="120">
              <template #default="{ row }"><span class="amt">{{ money(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column label="风险分" width="90">
              <template #default="{ row }"><span class="score" :class="'s-' + row.level">{{ row.score }}</span></template>
            </el-table-column>
            <el-table-column label="等级" width="100">
              <template #default="{ row }">
                <el-tag :type="levelTag(row.level)" size="small" effect="dark">{{ levelLabel(row.level) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="命中数" width="80">
              <template #default="{ row }">{{ row.hits.length }}</template>
            </el-table-column>
            <el-table-column label="审核状态" width="120">
              <template #default="{ row }">
                <el-tag :type="reviewStatusTag(row.reviewStatus)" size="small" effect="light">{{ reviewStatusLabel(row.reviewStatus) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="openDetail(row)">评分明细</el-button>
                <el-button
                  v-if="row.reviewStatus === 'pending'"
                  type="warning"
                  link
                  size="small"
                  @click="openReview(row)"
                >人工审核</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 规则引擎 -->
      <el-tab-pane :label="`规则引擎 (${summary.ruleCount})`" name="rules">
        <el-card class="list-card" shadow="never">
          <div class="toolbar">
            <div class="tip">规则引擎：每条规则带分值权重，命中累加得到风险分；命中黑名单直接判高风险（§26）。</div>
            <el-button type="primary" @click="openNewRule"><AppIcon name="plus" :size="15" /> 新建规则</el-button>
          </div>
          <el-table :data="rules" class="risk-table" empty-text="暂无规则" row-key="id">
            <el-table-column label="启用" width="80">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" :before-change="() => toggleRule(row)" />
              </template>
            </el-table-column>
            <el-table-column label="规则名称" prop="name" min-width="150" />
            <el-table-column label="类别" width="120">
              <template #default="{ row }">
                <el-tag :type="categoryTag(row.category)" size="small" effect="light">{{ categoryLabel(row.category) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="说明" prop="description" min-width="220" show-overflow-tooltip />
            <el-table-column label="分值" width="80">
              <template #default="{ row }"><span class="score-plain">+{{ row.score }}</span></template>
            </el-table-column>
            <el-table-column label="严重度" width="100">
              <template #default="{ row }">
                <el-tag :type="levelTag(row.severity)" size="small" effect="dark">{{ levelLabel(row.severity) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button type="danger" link size="small" @click="removeRule(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 黑名单 -->
      <el-tab-pane :label="`黑名单 (${summary.blacklistCount})`" name="blacklist">
        <el-card class="list-card" shadow="never">
          <div class="toolbar">
            <div class="tip">黑名单（§26）：地址 / 买家 / 支付任一命中即判高风险，建议结合拦截与抽检。</div>
            <el-button type="primary" @click="openNewBlacklist"><AppIcon name="plus" :size="15" /> 加入黑名单</el-button>
          </div>
          <el-table :data="blacklist" class="risk-table" empty-text="暂无黑名单" row-key="id">
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag :type="blacklistTag(row.type)" size="small" effect="light">{{ blacklistTypeLabel(row.type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="黑名单值" prop="value" min-width="260">
              <template #default="{ row }"><span class="mono">{{ row.value }}</span></template>
            </el-table-column>
            <el-table-column label="原因" prop="reason" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button type="danger" link size="small" @click="removeBlacklist(row)">移除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 评分明细 + 人工审核 -->
    <el-dialog v-model="detailVisible" title="风险评分明细" width="560px">
      <div v-if="detailRow" class="detail">
        <div class="detail-head">
          <div>订单 <span class="mono">{{ detailRow.platformOrderNo }}</span> · 收件人 {{ detailRow.recipientName }}</div>
          <el-tag :type="levelTag(detailRow.level)" size="small" effect="dark">{{ levelLabel(detailRow.level) }} · {{ detailRow.score }} 分</el-tag>
        </div>
        <el-table :data="detailRow.hits" class="detail-table" size="small">
          <el-table-column label="命中规则" prop="ruleName" min-width="140" />
          <el-table-column label="类别" width="110">
            <template #default="{ row }">
              <el-tag :type="categoryTag(row.category)" size="small" effect="light">{{ categoryLabel(row.category) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分值" width="80">
            <template #default="{ row }"><span class="score-plain">+{{ row.scoreDelta }}</span></template>
          </el-table-column>
          <el-table-column label="证据" prop="detail" min-width="200" show-overflow-tooltip />
        </el-table>
        <div class="review-box">
          <div class="review-status">审核状态：{{ reviewStatusLabel(detailRow.reviewStatus) }}</div>
          <div v-if="detailRow.reviewStatus === 'pending'" class="review-act">
            <el-radio-group v-model="reviewForm.decision">
              <el-radio value="approved">审核通过</el-radio>
              <el-radio value="rejected">审核驳回</el-radio>
            </el-radio-group>
            <el-input v-model="reviewForm.note" type="textarea" :rows="2" placeholder="审核意见（可选）" class="review-note-input" />
            <el-button type="primary" :loading="saving" @click="confirmReview">提交审核</el-button>
          </div>
          <div v-else class="review-done">
            已由 {{ detailRow.reviewedBy || '—' }} 处理
            <span v-if="detailRow.reviewNote">（{{ detailRow.reviewNote }}）</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 新建规则 -->
    <el-dialog v-model="ruleVisible" title="新建风控规则" width="480px" @closed="resetRule">
      <el-form :model="ruleForm" label-width="80px">
        <el-form-item label="规则名称" required>
          <el-input v-model="ruleForm.name" placeholder="如 高频下单异常" />
        </el-form-item>
        <el-form-item label="类别" required>
          <el-select v-model="ruleForm.category" placeholder="请选择" class="full">
            <el-option v-for="c in CATEGORY_LIST" :key="c" :label="RISK_CATEGORY_LABELS[c]" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="分值">
          <el-input-number v-model="ruleForm.score" :min="0" :max="100" :step="5" controls-position="right" class="full" />
        </el-form-item>
        <el-form-item label="严重度">
          <el-select v-model="ruleForm.severity" placeholder="请选择" class="full">
            <el-option v-for="l in LEVEL_LIST" :key="l" :label="RISK_LEVEL_LABELS[l]" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="ruleForm.description" type="textarea" :rows="2" placeholder="命中条件的人话描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmRule">提交</el-button>
      </template>
    </el-dialog>

    <!-- 加入黑名单 -->
    <el-dialog v-model="blVisible" title="加入黑名单" width="480px" @closed="resetBlacklist">
      <el-form :model="blForm" label-width="80px">
        <el-form-item label="类型" required>
          <el-select v-model="blForm.type" placeholder="请选择" class="full">
            <el-option v-for="t in BLACKLIST_LIST" :key="t" :label="BLACKLIST_TYPE_LABELS[t]" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="黑名单值" required>
          <el-input v-model="blForm.value" placeholder="地址归一串 / 买家标识 / 支付账户" />
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="blForm.reason" type="textarea" :rows="2" placeholder="拉黑原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="blVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmBlacklist">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  riskApi,
  type RiskOrderEvaluation,
  type RiskRule,
  type RiskCategory,
  type RiskLevel,
  type BlacklistEntry,
  type BlacklistType,
  type ReviewStatus,
  RISK_CATEGORY_LABELS,
  RISK_CATEGORY_TAG,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_TAG,
  BLACKLIST_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_TAG,
} from '@/api/risk'
import { money } from '@/locales'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 风控中心页（任务 5.1，方案 §26）：规则引擎 + 评分 + 黑名单 + 人工审核；演示/正式双路通。

const CATEGORY_LIST: RiskCategory[] = ['fraud', 'blacklist', 'misdeclaration']
const LEVEL_LIST: RiskLevel[] = ['low', 'medium', 'high']
const BLACKLIST_LIST: BlacklistType[] = ['address', 'buyer', 'payment']

// 模板里 el-table 的 row 为 any，索引字面量联合类型的 Record 会触发 TS7053；
// 故在脚本侧提供带类型的取值函数，模板只调用函数（any → 形参类型安全）。
function categoryLabel(c: RiskCategory): string {
  return RISK_CATEGORY_LABELS[c]
}
function categoryTag(c: RiskCategory): 'danger' | 'warning' | 'info' {
  return RISK_CATEGORY_TAG[c]
}
function levelLabel(l: RiskLevel): string {
  return RISK_LEVEL_LABELS[l]
}
function levelTag(l: RiskLevel): 'success' | 'warning' | 'danger' {
  return RISK_LEVEL_TAG[l]
}
function blacklistTypeLabel(t: BlacklistType): string {
  return BLACKLIST_TYPE_LABELS[t]
}
function blacklistTag(t: BlacklistType): 'danger' | 'warning' | 'info' {
  // 地址/支付偏高危用 danger，买家用 warning，视觉区分即可
  return t === 'buyer' ? 'warning' : 'danger'
}
function reviewStatusLabel(s: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[s]
}
function reviewStatusTag(s: ReviewStatus): 'warning' | 'success' | 'danger' | 'info' {
  return REVIEW_STATUS_TAG[s]
}

const tab = ref<'orders' | 'rules' | 'blacklist'>('orders')
const summary = reactive<{ scanned: number; highRisk: number; pendingReview: number; blacklistCount: number; ruleCount: number }>({
  scanned: 0, highRisk: 0, pendingReview: 0, blacklistCount: 0, ruleCount: 0,
})
const orders = ref<RiskOrderEvaluation[]>([])
const rules = ref<RiskRule[]>([])
const blacklist = ref<BlacklistEntry[]>([])
const loadingOrders = ref(false)
const saving = ref(false)

async function refreshSummary(): Promise<void> {
  try {
    const s = await riskApi.summary()
    Object.assign(summary, s)
  } catch (e) {
    ElMessage.error('风控总览加载失败：' + (e as Error).message)
  }
}
async function refreshOrders(): Promise<void> {
  loadingOrders.value = true
  try {
    orders.value = await riskApi.listOrders()
  } catch (e) {
    ElMessage.error('风险订单加载失败：' + (e as Error).message)
  } finally {
    loadingOrders.value = false
  }
}
async function refreshRules(): Promise<void> {
  try {
    rules.value = await riskApi.listRules()
  } catch (e) {
    ElMessage.error('规则加载失败：' + (e as Error).message)
  }
}
async function refreshBlacklist(): Promise<void> {
  try {
    blacklist.value = await riskApi.listBlacklist()
  } catch (e) {
    ElMessage.error('黑名单加载失败：' + (e as Error).message)
  }
}

// ---- 规则引擎：启停开关 / 删除 ----
async function toggleRule(row: RiskRule): Promise<boolean> {
  try {
    await riskApi.updateRule(row.id, { enabled: !row.enabled })
    await refreshSummary()
    ElMessage.success(row.enabled ? '规则已停用' : '规则已启用')
    return true
  } catch (e) {
    ElMessage.error('更新失败：' + (e as Error).message)
    return false
  }
}
async function removeRule(row: RiskRule): Promise<void> {
  try {
    await riskApi.deleteRule(row.id)
    rules.value = rules.value.filter((r) => r.id !== row.id)
    await refreshSummary()
    ElMessage.success('规则已删除')
  } catch (e) {
    ElMessage.error('删除失败：' + (e as Error).message)
  }
}

// ---- 黑名单：移除 ----
async function removeBlacklist(row: BlacklistEntry): Promise<void> {
  try {
    await riskApi.removeBlacklist(row.id)
    blacklist.value = blacklist.value.filter((b) => b.id !== row.id)
    await refreshSummary()
    ElMessage.success('已移除黑名单')
  } catch (e) {
    ElMessage.error('移除失败：' + (e as Error).message)
  }
}

// ---- 评分明细 + 人工审核 ----
const detailVisible = ref(false)
const detailRow = ref<RiskOrderEvaluation | null>(null)
const reviewForm = reactive<{ decision: 'approved' | 'rejected'; note: string }>({ decision: 'approved', note: '' })

function openDetail(row: RiskOrderEvaluation): void {
  detailRow.value = row
  reviewForm.decision = 'approved'
  reviewForm.note = ''
  detailVisible.value = true
}
function openReview(row: RiskOrderEvaluation): void {
  openDetail(row)
}
async function confirmReview(): Promise<void> {
  if (!detailRow.value) return
  saving.value = true
  try {
    const updated = await riskApi.reviewOrder(detailRow.value.id, {
      decision: reviewForm.decision,
      note: reviewForm.note.trim() || undefined,
    })
    Object.assign(detailRow.value, updated)
    orders.value = orders.value.map((o) => (o.id === updated.id ? updated : o))
    await refreshSummary()
    ElMessage.success(reviewForm.decision === 'approved' ? '已审核通过' : '已审核驳回')
    detailVisible.value = false
  } catch (e) {
    ElMessage.error('审核失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

// ---- 新建规则 ----
const ruleVisible = ref(false)
const ruleForm = reactive<{ name: string; category: RiskCategory | ''; score: number; severity: RiskLevel; description: string }>({
  name: '', category: '', score: 30, severity: 'medium', description: '',
})
function openNewRule(): void {
  ruleVisible.value = true
}
function resetRule(): void {
  ruleForm.name = ''
  ruleForm.category = ''
  ruleForm.score = 30
  ruleForm.severity = 'medium'
  ruleForm.description = ''
}
async function confirmRule(): Promise<void> {
  if (!ruleForm.name.trim()) {
    ElMessage.warning('请填写规则名称')
    return
  }
  if (!ruleForm.category) {
    ElMessage.warning('请选择类别')
    return
  }
  saving.value = true
  try {
    const created = await riskApi.createRule({
      name: ruleForm.name.trim(),
      category: ruleForm.category as RiskCategory,
      score: ruleForm.score,
      severity: ruleForm.severity,
      description: ruleForm.description.trim() || undefined,
    })
    rules.value.unshift(created)
    await refreshSummary()
    ElMessage.success('规则已创建')
    ruleVisible.value = false
  } catch (e) {
    ElMessage.error('创建失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

// ---- 加入黑名单 ----
const blVisible = ref(false)
const blForm = reactive<{ type: BlacklistType | ''; value: string; reason: string }>({
  type: '', value: '', reason: '',
})
function openNewBlacklist(): void {
  blVisible.value = true
}
function resetBlacklist(): void {
  blForm.type = ''
  blForm.value = ''
  blForm.reason = ''
}
async function confirmBlacklist(): Promise<void> {
  if (!blForm.type) {
    ElMessage.warning('请选择类型')
    return
  }
  if (!blForm.value.trim()) {
    ElMessage.warning('请填写黑名单值')
    return
  }
  saving.value = true
  try {
    const created = await riskApi.addBlacklist({
      type: blForm.type as BlacklistType,
      value: blForm.value.trim(),
      reason: blForm.reason.trim() || undefined,
    })
    blacklist.value.unshift(created)
    await refreshSummary()
    ElMessage.success('已加入黑名单')
    blVisible.value = false
  } catch (e) {
    ElMessage.error('加入失败：' + (e as Error).message)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await refreshSummary()
  await Promise.all([refreshOrders(), refreshRules(), refreshBlacklist()])
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
  margin-bottom: 12px;
}
.ico-scan {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
}
.ico-high {
  background: linear-gradient(135deg, var(--red-500), #dc2626);
  box-shadow: 0 6px 18px rgba(220, 38, 38, 0.3);
}
.ico-pending {
  background: linear-gradient(135deg, var(--amber-500), #e07b07);
  box-shadow: 0 6px 18px rgba(247, 144, 9, 0.3);
}
.ico-bl {
  background: linear-gradient(135deg, var(--violet-500), #6d3bd4);
  box-shadow: 0 6px 18px rgba(109, 59, 212, 0.3);
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
.risk-tabs {
  margin-top: 4px;
}
.list-card {
  border-radius: var(--r-lg);
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  gap: 12px;
}
.tip {
  font-size: 12px;
  color: var(--ink-500);
  flex: 1;
}
.risk-table :deep(.el-tag) {
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
.score {
  font-weight: 800;
  font-size: 15px;
}
.score.s-low {
  color: var(--green-600, #10a96b);
}
.score.s-medium {
  color: var(--amber-600, #e07b07);
}
.score.s-high {
  color: var(--red-600, #dc2626);
}
.score-plain {
  font-weight: 700;
  color: var(--brand-600);
}
.hit-tag {
  margin: 2px 4px 2px 0;
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
  width: 84px;
  color: var(--ink-500);
  flex: none;
}
.ex-v {
  color: var(--ink-800);
}
.review-note {
  color: var(--ink-400);
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--ink-700);
}
.detail-table {
  margin-bottom: 12px;
}
.review-box {
  border-top: 1px dashed var(--line);
  padding-top: 12px;
}
.review-status {
  font-size: 13px;
  color: var(--ink-600);
  margin-bottom: 10px;
}
.review-act {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.review-note-input {
  max-width: 100%;
}
.review-done {
  font-size: 13px;
  color: var(--ink-500);
}
.full {
  width: 100%;
}
</style>
