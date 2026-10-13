<template>
  <div class="pricing">
    <PageHeader
      title="加价规则 / 币种"
      subtitle="平台加价规则引擎与币种归一 · 决定客户看到的最终售价"
      icon="sliders"
      accent="violet"
    >
      <template #actions>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="tip">
      <AppIcon name="coins" :size="16" class="tip-ico" />
      <div class="tip-body">
        <strong>加价规则说明</strong>
        <p>
          规则按 <b>作用域 + 优先级</b> 生效：承运商专属规则覆盖全局基础加价，
          品类规则可叠加（如带电 +6%）。最终售价 = 成本 × (1 + 有效加价率)。
        </p>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 加价规则 -->
      <el-col :span="14">
        <el-card>
          <template #header>
            <div class="card-head">
              <span class="section-title">加价规则</span>
              <span class="count-pill">共 {{ rules.length }} 条 · 生效 {{ enabledCount }} 条</span>
            </div>
          </template>

          <el-table v-loading="loading" :data="rules">
            <el-table-column label="作用域" width="92">
              <template #default="{ row }">
                <span class="tag-soft" :class="scopeClass(row.scope)">{{ scopeLabels[row.scope] }}</span>
              </template>
            </el-table-column>
            <el-table-column label="目标" min-width="130">
              <template #default="{ row }"><span class="strong">{{ row.target }}</span></template>
            </el-table-column>
            <el-table-column label="加价值" width="96" align="right">
              <template #default="{ row }">
                <span class="val">{{ fmtValue(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="优先级" width="86" align="center">
              <template #default="{ row }"><span class="muted">{{ row.priority }}</span></template>
            </el-table-column>
            <el-table-column label="状态" width="94" align="center">
              <template #default="{ row }">
                <el-switch v-model="row.enabled" @change="onToggle(row)" />
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="180">
              <template #default="{ row }"><span class="muted note">{{ row.note }}</span></template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 币种与汇率 -->
      <el-col :span="10">
        <el-card>
          <template #header><span class="section-title">币种与汇率</span></template>

          <el-table v-loading="loading" :data="fx">
            <el-table-column label="币种对" min-width="110">
              <template #default="{ row }">
                <span class="pair">
                  <span class="tag-soft tag-gray">{{ row.base }}</span>
                  <AppIcon name="arrowRight" :size="13" class="pair-arrow" />
                  <span class="tag-soft tag-brand">{{ row.quote }}</span>
                </span>
              </template>
            </el-table-column>
            <el-table-column label="汇率" width="100" align="right">
              <template #default="{ row }"><span class="rate">{{ row.rate }}</span></template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="150">
              <template #default="{ row }"><span class="muted">{{ fmt(row.updatedAt) }}</span></template>
            </el-table-column>
          </el-table>

          <p class="text-hint fx-hint">
            汇率用于成本（CNY 结算）与客户售价（USD 展示）之间的归一换算；
            生产环境由定时任务刷新并落库快照。
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { pricingApi, SCOPE_LABELS, type MarkupRule, type FxRate } from '@/api/pricing'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 加价规则 / 币种配置页（阶段3.6 引擎成果 + 4.6 运营配置后台雏形）。
// 表格 slot 的 row 为 any，故将标签字典放宽索引类型为 string 以避免 TS7053。
const scopeLabels: Record<string, string> = SCOPE_LABELS
const rules = ref<MarkupRule[]>([])
const fx = ref<FxRate[]>([])
const loading = ref(false)

const enabledCount = computed(() => rules.value.filter((r) => r.enabled).length)

function scopeClass(scope: string): string {
  const map: Record<string, string> = {
    global: 'tag-brand',
    tenant: 'tag-violet',
    carrier: 'tag-teal',
    channel: 'tag-orange',
    product: 'tag-amber',
  }
  return map[scope] ?? 'tag-gray'
}

function fmtValue(row: MarkupRule): string {
  return row.mode === 'percent' ? `${row.value}%` : `+$${row.value.toFixed(2)}`
}

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function onToggle(row: MarkupRule): void {
  ElMessage.info(`${row.target} 加价规则已${row.enabled ? '启用' : '停用'}（演示，未落库）`)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [r, f] = await Promise.all([pricingApi.markupRules(), pricingApi.fxRates()])
    rules.value = r
    fx.value = f
  } catch (e) {
    ElMessage.error('加载定价配置失败：' + (e as Error).message)
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
.tip {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 16px;
  margin-bottom: 16px;
  border-radius: var(--r-md);
  background: linear-gradient(90deg, var(--violet-soft), #faf7ff);
  border: 1px solid #e9e0ff;
}
.tip-ico {
  color: var(--violet-500);
  margin-top: 2px;
}
.tip-body {
  font-size: 13px;
  color: var(--ink-700);
  line-height: 1.7;
}
.tip-body strong {
  display: block;
  color: var(--ink-900);
  margin-bottom: 3px;
}
.tip-body p {
  margin: 0;
}
.tip-body b {
  color: #6d28d9;
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
  color: #6d28d9;
  background: var(--violet-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}

.strong {
  font-weight: 600;
  color: var(--ink-800);
}
.val {
  font-weight: 700;
  color: var(--brand-600);
}
.muted {
  color: var(--ink-500);
}
.note {
  font-size: 12.5px;
}

.pair {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.pair-arrow {
  color: var(--ink-300);
}
.rate {
  font-weight: 700;
  color: var(--ink-900);
}
.fx-hint {
  margin: 14px 0 0;
}
</style>
