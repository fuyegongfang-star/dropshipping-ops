<template>
  <div class="progress">
    <PageHeader
      title="开发进度 / 最近交付"
      subtitle="自动开发每晚推进一批任务 · 次日刷新本页即可看到最新完成的能力"
      icon="target"
      accent="brand"
    >
      <template #actions>
        <span
          class="gen-pill"
          :title="'数据源：dev-schedule.md · 提交 ' + (DEV_PROGRESS_COMMIT || '—')"
        >
          <AppIcon name="refresh" :size="13" />数据同步于 {{ generatedAtText }}
        </span>
      </template>
    </PageHeader>

    <!-- 总体完成度 -->
    <div class="overall">
      <div class="ov-main">
        <div class="ov-percent">
          <span class="num">{{ stats.percent }}<small>%</small></span>
          <span class="lbl">总体完成度</span>
        </div>
        <div class="ov-bar">
          <span class="ov-fill" :style="{ width: stats.percent + '%' }" />
        </div>
      </div>
      <div class="ov-cards">
        <div v-for="c in statCards" :key="c.label" class="mini-card">
          <span class="mini-num" :class="c.cls">{{ c.value }}</span>
          <span class="mini-label">{{ c.label }}</span>
        </div>
      </div>
    </div>

    <!-- 最近交付 -->
    <el-card class="recent-card">
      <template #header>
        <div class="card-head">
          <span class="section-title"
            ><AppIcon name="sparkle" :size="15" class="ttl-ico" />最近交付</span
          >
          <span class="count-pill">已完成 {{ stats.done }} / {{ stats.total }} 项</span>
        </div>
      </template>
      <div class="recent">
        <div v-for="t in recentTasks" :key="t.id" class="recent-item">
          <span class="recent-id">{{ t.id }}</span>
          <div class="recent-body">
            <div class="recent-name">{{ t.name }}<span class="new-tag">NEW</span></div>
            <div class="recent-deliv">{{ t.deliverable }}</div>
          </div>
          <router-link v-if="t.route" class="go-btn" :to="t.route">去查看</router-link>
          <span v-else class="go-none">后端接口已就绪</span>
        </div>
      </div>
    </el-card>

    <!-- 分阶段任务清单 -->
    <el-card class="list-card">
      <template #header>
        <div class="card-head">
          <span class="section-title">任务清单</span>
          <div class="filter">
            <el-radio-group v-model="phaseFilter" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button v-for="p in phases" :key="p" :value="p">{{ p }}</el-radio-button>
            </el-radio-group>
            <el-input v-model="keyword" class="kw" size="small" clearable placeholder="搜索任务">
              <template #prefix><AppIcon name="search" :size="14" /></template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table :data="filtered" :row-class-name="rowClass">
        <el-table-column label="序号" width="70">
          <template #default="{ row }"
            ><span class="tid">{{ row.id }}</span></template
          >
        </el-table-column>
        <el-table-column label="阶段" width="76">
          <template #default="{ row }"
            ><span class="muted">{{ row.phase }}</span></template
          >
        </el-table-column>
        <el-table-column label="任务" min-width="150">
          <template #default="{ row }">
            <span class="tname">{{ row.name }}</span>
            <span v-if="isRecent(row.id)" class="new-tag">NEW</span>
          </template>
        </el-table-column>
        <el-table-column label="关键产出 / 方案章节" min-width="200">
          <template #default="{ row }"
            ><span class="muted deliv">{{ row.deliverable }}</span></template
          >
        </el-table-column>
        <el-table-column label="依赖" width="80">
          <template #default="{ row }"
            ><span class="muted">{{ row.deps }}</span></template
          >
        </el-table-column>
        <el-table-column label="预估" width="70">
          <template #default="{ row }"
            ><span class="muted">{{ row.estimate }}</span></template
          >
        </el-table-column>
        <el-table-column label="状态" width="94" align="center">
          <template #default="{ row }">
            <span class="tag-soft" :class="statusCls(row.status)">{{
              statusText(row.status)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column label="界面" width="80" align="center">
          <template #default="{ row }">
            <router-link v-if="row.route" class="go-link" :to="row.route">查看</router-link>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  DEV_TASKS,
  DEV_STATS,
  DEV_PHASES,
  DEV_RECENT_IDS,
  DEV_PROGRESS_COMMIT,
  DEV_PROGRESS_GENERATED_AT,
  type DevTask,
  type TaskStatus,
} from '@/api/dev-progress'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 开发进度页（数据由 scripts/gen-progress.cjs 从 dev-schedule.md 生成）。
// 目的：无论演示模式还是正式模式，用户刷新网页即可看到每日自动开发的产出。
const stats = DEV_STATS
const phases = DEV_PHASES
const recentIds = DEV_RECENT_IDS
const recentTasks = DEV_TASKS.filter((t) => recentIds.includes(t.id))

const phaseFilter = ref('all')
const keyword = ref('')

const statCards = [
  { label: '已完成', value: stats.done, cls: 'c-green' },
  { label: '待开始', value: stats.todo, cls: 'c-gray' },
  { label: '进行中', value: stats.doing, cls: 'c-brand' },
  { label: '受阻 / 跳过', value: stats.blocked + stats.skipped, cls: 'c-orange' },
]

const STATUS_TEXT: Record<TaskStatus, string> = {
  done: '已完成',
  doing: '进行中',
  todo: '待开始',
  blocked: '受阻',
  skipped: '跳过',
}
const STATUS_CLS: Record<TaskStatus, string> = {
  done: 'tag-green',
  doing: 'tag-brand',
  todo: 'tag-gray',
  blocked: 'tag-orange',
  skipped: 'tag-amber',
}

function statusText(s: TaskStatus): string {
  return STATUS_TEXT[s] ?? s
}
function statusCls(s: TaskStatus): string {
  return STATUS_CLS[s] ?? 'tag-gray'
}
function isRecent(id: string): boolean {
  return recentIds.includes(id)
}
function rowClass({ row }: { row: DevTask }): string {
  return isRecent(row.id) ? 'row-new' : ''
}

const generatedAtText = computed(() => {
  const t = new Date(DEV_PROGRESS_GENERATED_AT)
  const stamp = Number.isNaN(t.getTime())
    ? DEV_PROGRESS_GENERATED_AT
    : t.toLocaleString('zh-CN', { hour12: false })
  return DEV_PROGRESS_COMMIT ? `${stamp} · ${DEV_PROGRESS_COMMIT}` : stamp
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return DEV_TASKS.filter((t) => {
    if (phaseFilter.value !== 'all' && t.phase !== phaseFilter.value) return false
    if (
      kw &&
      !t.id.includes(kw) &&
      !t.name.toLowerCase().includes(kw) &&
      !t.deliverable.toLowerCase().includes(kw)
    ) {
      return false
    }
    return true
  })
})
</script>

<style scoped>
.gen-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink-600);
  font-size: 12.5px;
}

/* 总体完成度 */
.overall {
  display: flex;
  gap: 16px;
  align-items: stretch;
  margin-bottom: 16px;
}
.ov-main {
  flex: 1;
  background: linear-gradient(120deg, #f2f5ff, #fbfcff);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  padding: 18px 20px;
}
.ov-percent {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.ov-percent .num {
  font-size: 34px;
  font-weight: 800;
  color: var(--brand-600);
  line-height: 1;
}
.ov-percent .num small {
  font-size: 17px;
  margin-left: 2px;
}
.ov-percent .lbl {
  font-size: 13px;
  color: var(--ink-500);
}
.ov-bar {
  height: 9px;
  background: #e6ebfa;
  border-radius: var(--r-pill);
  overflow: hidden;
}
.ov-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-pill);
  background: linear-gradient(90deg, var(--brand-500), var(--violet-500));
  transition: width 0.5s var(--ease);
}
.ov-cards {
  display: grid;
  grid-template-columns: repeat(2, 96px);
  gap: 12px;
}
.mini-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.mini-num {
  font-size: 20px;
  font-weight: 800;
}
.mini-label {
  font-size: 11.5px;
  color: var(--ink-500);
}
.c-green {
  color: var(--green-500);
}
.c-gray {
  color: var(--ink-500);
}
.c-brand {
  color: var(--brand-600);
}
.c-orange {
  color: var(--orange-500);
}

/* 卡片头 */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}
.card-head .section-title {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ttl-ico {
  color: var(--brand-500);
}
.count-pill {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}

/* 最近交付 */
.recent-card {
  margin-bottom: 16px;
}
.recent {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.recent-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--r-md);
  background: #fbfcff;
  border: 1px solid var(--line);
}
.recent-id {
  flex: none;
  font-weight: 700;
  font-size: 12.5px;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--violet-500));
  padding: 3px 8px;
  border-radius: 7px;
}
.recent-body {
  flex: 1;
  min-width: 0;
}
.recent-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-800);
  display: flex;
  align-items: center;
  gap: 6px;
}
.recent-deliv {
  font-size: 12px;
  color: var(--ink-500);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.new-tag {
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #ff7a45, #f5222d);
  padding: 1px 5px;
  border-radius: 5px;
  letter-spacing: 0.4px;
}
.go-btn {
  flex: none;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--brand-600);
  background: var(--brand-soft);
  padding: 5px 12px;
  border-radius: var(--r-pill);
  text-decoration: none;
  transition: all 0.18s var(--ease);
}
.go-btn:hover {
  background: var(--brand-500);
  color: #fff;
}
.go-none {
  flex: none;
  font-size: 12px;
  color: var(--ink-400);
}

/* 任务清单 */
.filter {
  display: flex;
  align-items: center;
  gap: 10px;
}
.kw {
  width: 170px;
}
.tid {
  font-weight: 700;
  color: var(--brand-600);
}
.tname {
  font-weight: 600;
  color: var(--ink-800);
  margin-right: 6px;
}
.deliv {
  font-size: 12.5px;
}
.muted {
  color: var(--ink-500);
}
.go-link {
  color: var(--brand-600);
  font-size: 12.5px;
  font-weight: 600;
  text-decoration: none;
}
.go-link:hover {
  text-decoration: underline;
}
.progress :deep(.row-new td) {
  background: #f7f9ff !important;
}
</style>
