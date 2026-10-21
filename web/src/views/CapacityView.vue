<template>
  <div class="capacity">
    <PageHeader
      title="容量与灾备"
      subtitle="§30 拉单限流 / 比价并发 / 灾备目标（压测与运维观测）"
      icon="bolt"
      accent="violet"
    />

    <!-- 核心态势卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-limit"><AppIcon name="bolt" :size="20" /></div>
          <div class="stat-label">单租户拉单并发上限</div>
          <div class="stat-value">{{ status?.config.maxConcurrentPullsPerTenant ?? '—' }}</div>
          <div class="stat-sub">超限返回 PULL_THROTTLED（HTTP 429）</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-inflight"><AppIcon name="radar" :size="20" /></div>
          <div class="stat-label">当前在途店铺锁</div>
          <div class="stat-value" :class="inflightClass">{{ status?.throttle.inflightShopCount ?? '—' }}</div>
          <div class="stat-sub">实时统计 · TTL {{ (status?.throttle.pullInflightTtlMs ?? 0) / 1000 }}s 兜底防死锁</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-rpo"><AppIcon name="clock" :size="20" /></div>
          <div class="stat-label">灾备目标 RTO / RPO</div>
          <div class="stat-value">{{ rtoText }} <span class="slash">/</span> {{ rpoText }}</div>
          <div class="stat-sub">WAL 归档 · 全量+增量备份</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：容量阈值 -->
      <el-col :span="14">
        <el-card class="cap-card" shadow="never">
          <template #header><span class="section-title">§30 容量阈值</span></template>
          <el-table :data="thresholdRows" class="cap-table" empty-text="暂无">
            <el-table-column label="指标" prop="name" min-width="150" />
            <el-table-column label="当前值" prop="value" width="140">
              <template #default="{ row }"><span class="mono">{{ row.value }}</span></template>
            </el-table-column>
            <el-table-column label="说明" prop="note" min-width="170" show-overflow-tooltip />
          </el-table>
        </el-card>

        <el-card class="cap-card" shadow="never">
          <template #header><span class="section-title">拉单限流实时统计</span></template>
          <div v-if="hasTenantStats" class="tenant-list">
            <div v-for="(n, t) in status?.throttle.perTenantActive ?? {}" :key="t" class="tenant-item">
              <span class="tenant-code">{{ t }}</span>
              <el-progress
                :percentage="tenantPercent(n)"
                :stroke-width="10"
                :show-text="false"
                class="tenant-bar"
              />
              <span class="tenant-num">{{ n }} / {{ status?.throttle.maxConcurrentPullsPerTenant }}</span>
            </div>
          </div>
          <el-empty v-else description="暂无在途拉单（演示态未触发）" :image-size="64" />
        </el-card>
      </el-col>

      <!-- 右：灾备策略 + 落地说明 -->
      <el-col :span="10">
        <el-card class="cap-card" shadow="never">
          <template #header><span class="section-title">灾备策略</span></template>
          <ul class="dr-list">
            <li><span class="dr-k">数据库全量备份</span><span class="dr-v mono">{{ status?.config.dbBackupCron ?? '—' }}</span></li>
            <li><span class="dr-k">全量备份保留</span><span class="dr-v">{{ status?.config.dbBackupRetentionDays ?? '—' }} 天</span></li>
            <li><span class="dr-k">对象存储增量</span><span class="dr-v mono">{{ status?.config.objectsBackupCron ?? '—' }}</span></li>
            <li><span class="dr-k">增量保留</span><span class="dr-v">{{ status?.config.objectBackupRetentionDays ?? '—' }} 天</span></li>
            <li><span class="dr-k">恢复时间 RTO</span><span class="dr-v">{{ rtoText }}</span></li>
            <li><span class="dr-k">恢复点 RPO</span><span class="dr-v">{{ rpoText }}</span></li>
          </ul>
        </el-card>

        <el-card class="cap-card" shadow="never">
          <template #header><span class="section-title">§30 落地说明</span></template>
          <ul class="note-list">
            <li v-for="(note, i) in status?.notes ?? []" :key="i"><AppIcon name="check" :size="14" /><span>{{ note }}</span></li>
          </ul>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { systemApi, type CapacityStatus } from '@/api/system'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 容量与灾备诊断页（任务 5.4，方案 §30）：展示限流实时统计 + 容量阈值 + 灾备目标。
const status = ref<CapacityStatus | null>(null)

const hasTenantStats = computed(() => Object.keys(status.value?.throttle.perTenantActive ?? {}).length > 0)

const inflightClass = computed(() =>
  (status.value?.throttle.inflightShopCount ?? 0) > 0 ? 'status-warn' : 'status-ok',
)

// RTO/RPO 毫秒 → 人类可读（§30 目标）
const rtoText = computed(() => fmtDuration(status.value?.config.rtoObjectiveMs))
const rpoText = computed(() => fmtDuration(status.value?.config.rpoObjectiveMs))

function fmtDuration(ms?: number): string {
  if (!ms) return '—'
  const min = ms / 60000
  if (min >= 60) return `${Math.round(min / 60)} 小时`
  if (min >= 1) return `${Math.round(min)} 分钟`
  return `${Math.round(ms / 1000)} 秒`
}

// 容量阈值表格行
const thresholdRows = computed(() => {
  const c = status.value?.config
  if (!c) return []
  return [
    { name: '单租户拉单并发上限', value: c.maxConcurrentPullsPerTenant, note: '超出直接拒绝，防雪崩（§30）' },
    { name: '单店铺在途锁 TTL', value: `${c.pullInflightTtlMs / 1000}s`, note: '异常未释放自动过期，防死锁' },
    { name: '比价实时池并发上限', value: c.pricingConcurrencyLimit, note: 'L3 有界并行（§5/§30）' },
    { name: 'RTO 恢复时间', value: rtoText.value, note: '故障到恢复上限' },
    { name: 'RPO 数据丢失窗口', value: rpoText.value, note: 'WAL 归档下可承受丢失' },
  ]
})

function tenantPercent(n: number): number {
  const max = status.value?.throttle.maxConcurrentPullsPerTenant ?? 1
  return Math.min(100, Math.round((n / max) * 100))
}

onMounted(async () => {
  try {
    status.value = await systemApi.getCapacity()
  } catch (e) {
    console.warn('[Capacity] 加载失败', (e as Error).message)
  }
})
</script>

<style scoped>
.stat-row {
  margin-bottom: 16px;
}
.stat-card {
  border-radius: var(--r-lg);
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
.ico-limit {
  background: linear-gradient(135deg, var(--violet-500), #5b3fe0);
  box-shadow: 0 6px 18px rgba(124, 92, 252, 0.32);
}
.ico-inflight {
  background: linear-gradient(135deg, var(--teal-500), #0e9488);
  box-shadow: 0 6px 18px rgba(18, 181, 165, 0.32);
}
.ico-rpo {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 6px 18px rgba(245, 158, 11, 0.3);
}
.stat-label {
  font-size: 13px;
  color: var(--ink-500);
  font-weight: 500;
}
.stat-value {
  font-size: 22px;
  font-weight: 800;
  color: var(--ink-900);
  margin: 4px 0 2px;
}
.slash {
  color: var(--ink-400);
  margin: 0 4px;
}
.status-ok {
  color: var(--green-500);
}
.status-warn {
  color: var(--amber-500);
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.cap-card {
  border-radius: var(--r-lg);
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.mono {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 600;
  color: var(--ink-800);
}
.tenant-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tenant-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tenant-code {
  width: 70px;
  font-weight: 600;
  font-size: 13px;
  color: var(--ink-700);
}
.tenant-bar {
  flex: 1;
}
.tenant-num {
  width: 64px;
  text-align: right;
  font-size: 12px;
  color: var(--ink-500);
  font-family: var(--font-mono, ui-monospace, monospace);
}
.dr-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dr-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px dashed var(--line);
  font-size: 13px;
}
.dr-list li:last-child {
  border-bottom: none;
}
.dr-k {
  color: var(--ink-600);
}
.dr-v {
  font-weight: 700;
  color: var(--ink-900);
}
.note-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.note-list li {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ink-600);
  align-items: flex-start;
}
.note-list li :deep(svg) {
  color: var(--green-500);
  margin-top: 3px;
  flex: none;
}
</style>
