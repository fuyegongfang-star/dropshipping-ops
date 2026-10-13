<template>
  <div class="carriers">
    <PageHeader
      title="承运商管理"
      subtitle="阶段3 适配器 · 云途 / DHL / 4PX / 燕文 · 能力矩阵与健康巡检"
      icon="truck"
      accent="teal"
    >
      <template #actions>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="tip">
      <AppIcon name="shield" :size="16" class="tip-ico" />
      <div class="tip-body">
        <strong>能力矩阵说明</strong>
        <p>
          每张卡片的六个徽章依次对应
          <b>比价 / 建单 / 面单 / 轨迹 / 取消 / 订阅</b>。未实现的能力不会被谎报为可用，
          调用时诚实返回 <b>NOT_IMPLEMENTED</b>（如 DHL 不支持取消、燕文不支持实时比价）。
        </p>
      </div>
    </div>

    <el-row :gutter="16">
      <el-col v-for="s in stats" :key="s.label" :span="6">
        <div class="stat-card">
          <span class="stat-deco" :style="{ background: s.deco }" />
          <span class="stat-ico" :class="s.bg"><AppIcon :name="s.icon" :size="22" /></span>
          <div class="stat-num">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row v-loading="loading" :gutter="16" class="carrier-grid">
      <el-col v-for="c in carriers" :key="c.code" :span="12">
        <el-card class="carrier-card">
          <div class="cc-head">
            <span class="cc-badge"><AppIcon name="truck" :size="20" /></span>
            <div class="cc-name">
              <div class="cc-title">
                {{ c.name }}
                <span class="cc-en">{{ c.enName }}</span>
              </div>
              <div class="cc-sub">{{ c.region }}</div>
            </div>
            <div class="cc-right">
              <span class="health" :class="healthClass(c.health.status)">
                <i class="health-dot" />{{ healthLabels[c.health.status] }}
              </span>
              <span v-if="c.sandbox" class="tag-soft tag-amber">沙箱</span>
            </div>
          </div>

          <div class="cc-auth">
            <AppIcon name="shield" :size="14" class="cc-auth-ico" />
            鉴权方式：<b>{{ c.authType }}</b>
          </div>

          <div class="caps">
            <span
              v-for="cap in capabilityLabels"
              :key="cap.key"
              class="cap"
              :class="c.capabilities[cap.key] ? 'cap-on' : 'cap-off'"
            >
              <AppIcon :name="c.capabilities[cap.key] ? 'check' : 'close'" :size="12" />
              {{ cap.label }}
            </span>
          </div>

          <div class="cc-foot">
            <span class="cc-metric"><AppIcon name="bolt" :size="13" />时延 {{ c.health.latencyMs }} ms</span>
            <span class="cc-metric"><AppIcon name="clock" :size="13" />可用率 {{ c.health.uptime }}%</span>
          </div>
          <div class="cc-note">{{ c.note }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { carriersApi, CAPABILITY_LABELS, type Carrier } from '@/api/carriers'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 承运商管理页（阶段3.1~3.4 适配器成果可视化）。
const capabilityLabels = CAPABILITY_LABELS
const healthLabels: Record<string, string> = { up: '在线', degraded: '降级', down: '离线' }

const carriers = ref<Carrier[]>([])
const loading = ref(false)

/** 顶部四张汇总卡 */
const stats = computed(() => {
  const total = carriers.value.length
  const online = carriers.value.filter((c) => c.health.status === 'up').length
  const caps = carriers.value.reduce(
    (n, c) => n + Object.values(c.capabilities).filter(Boolean).length,
    0,
  )
  const capTotal = total * CAPABILITY_LABELS.length
  const avg = total
    ? Math.round(carriers.value.reduce((n, c) => n + c.health.latencyMs, 0) / total)
    : 0
  return [
    { label: '已接入承运商', value: total, icon: 'truck', bg: 'bg-teal', deco: 'var(--teal-500)' },
    { label: '服务在线', value: `${online}/${total}`, icon: 'shield', bg: 'bg-brand', deco: 'var(--brand-500)' },
    { label: '能力覆盖', value: `${caps}/${capTotal}`, icon: 'layers', bg: 'bg-violet', deco: 'var(--violet-500)' },
    { label: '平均时延 (ms)', value: avg, icon: 'bolt', bg: 'bg-orange', deco: 'var(--orange-500)' },
  ]
})

function healthClass(status: string): string {
  if (status === 'up') return 'h-up'
  if (status === 'degraded') return 'h-degraded'
  return 'h-down'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    carriers.value = await carriersApi.list()
  } catch (e) {
    ElMessage.error('加载承运商失败：' + (e as Error).message)
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
  background: linear-gradient(90deg, var(--teal-soft), #f6fffd);
  border: 1px solid #d5f3ee;
}
.tip-ico {
  color: #0f8f82;
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
  color: #0f766e;
}

/* 统计卡图标渐变底（与仪表盘一致） */
.bg-brand {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}
.bg-teal {
  background: linear-gradient(135deg, #14c9b6, #0f8f82);
}
.bg-violet {
  background: linear-gradient(135deg, #9a7bff, #6d28d9);
}
.bg-orange {
  background: linear-gradient(135deg, #ffa257, #f97316);
}

/* 承运商卡片网格 */
.carrier-grid {
  margin-top: 16px;
}
.carrier-grid :deep(.el-col) {
  margin-bottom: 16px;
}
.carrier-card :deep(.el-card__body) {
  padding: 18px 20px;
}
.cc-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cc-badge {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #14c9b6, #0f8f82);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(20, 201, 182, 0.3);
  flex: none;
}
.cc-name {
  flex: 1;
  min-width: 0;
}
.cc-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-900);
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.cc-en {
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-400);
}
.cc-sub {
  font-size: 12px;
  color: var(--ink-500);
  margin-top: 2px;
}
.cc-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.health {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}
.health-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px currentColor;
  opacity: 0.9;
}
.h-up {
  color: var(--green-500);
}
.h-degraded {
  color: var(--amber-500);
}
.h-down {
  color: var(--red-500);
}

.cc-auth {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 14px 0 12px;
  font-size: 12.5px;
  color: var(--ink-600);
}
.cc-auth-ico {
  color: var(--brand-500);
}
.cc-auth b {
  color: var(--ink-800);
  font-weight: 600;
}

.caps {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.cap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 9px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: 600;
}
.cap-on {
  color: #0f766e;
  background: var(--teal-soft);
}
.cap-off {
  color: var(--ink-400);
  background: var(--line-soft);
  text-decoration: line-through;
  text-decoration-color: var(--ink-300);
}

.cc-foot {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-top: 14px;
}
.cc-metric {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--ink-600);
  font-weight: 500;
}
.cc-note {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  font-size: 12px;
  color: var(--ink-500);
  line-height: 1.6;
}
</style>
