<template>
  <div class="reports">
    <PageHeader
      icon="chart"
      title="运营报表"
      subtitle="履约 / 物流时效 · 利润 · 渠道分布 · 异常率（方案 §25 报表指标）"
    />

    <!-- 核心指标卡 -->
    <div class="stat-grid">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-ico" style="background: var(--brand-soft); color: var(--brand-600)">
          <AppIcon name="clock" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">整体履约达成率</div>
          <div class="stat-value">{{ fulfillmentText }}</div>
          <div class="stat-sub">下单→签收 三段几何均值</div>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-ico" style="background: #fdecec; color: #ef4444">
          <AppIcon name="warning" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">综合异常率</div>
          <div class="stat-value">{{ exceptionText }}</div>
          <div class="stat-sub">延误 / 拒收 / 丢件</div>
        </div>
      </el-card>
      <el-card class="stat-card stat-profit" shadow="hover">
        <div class="stat-ico" style="background: #e7f7f3; color: #12b5a5">
          <AppIcon name="trend" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">近 6 期平台利润</div>
          <div class="stat-value">{{ profitTotalText }}</div>
          <div class="stat-sub">spread 累计（基准币）</div>
        </div>
      </el-card>
      <el-card class="stat-card" shadow="hover">
        <div class="stat-ico" style="background: var(--violet-soft); color: #7c3aed">
          <AppIcon name="box" :size="20" />
        </div>
        <div class="stat-body">
          <div class="stat-label">总单量</div>
          <div class="stat-value">{{ totalOrdersText }}</div>
          <div class="stat-sub">全渠道累计</div>
        </div>
      </el-card>
    </div>

    <!-- 图表行 1 -->
    <el-row :gutter="16">
      <el-col :xs="24" :lg="12">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="card-title">履约时效 · 各段平均时长（小时）</span></template>
          <BaseChart :option="fulfillmentOption" height="280px" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="12">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="card-title">物流时效 · 各渠道平均时效与异常率</span></template>
          <BaseChart :option="logisticsOption" height="280px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表行 2 -->
    <el-row :gutter="16">
      <el-col :xs="24" :lg="14">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="card-title">利润趋势 · 近 6 账期</span></template>
          <BaseChart :option="profitOption" height="300px" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="10">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="card-title">渠道分布 · 单量占比</span></template>
          <BaseChart :option="channelPieOption" height="300px" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表行 3 -->
    <el-row :gutter="16">
      <el-col :xs="24" :lg="10">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="card-title">异常构成 · 数量分布</span></template>
          <BaseChart :option="exceptionPieOption" height="300px" />
        </el-card>
      </el-col>
      <el-col :xs="24" :lg="14">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="card-title">利润拆解 · 按租户 / 渠道</span></template>
          <el-table :data="profitTableRows" size="small">
            <el-table-column label="维度" prop="dim" />
            <el-table-column label="对象" prop="name" />
            <el-table-column label="平台利润" align="right">
              <template #default="{ row }"><b class="money">{{ fmt(row.margin) }}</b></template>
            </el-table-column>
            <el-table-column label="毛利率" align="right" width="90">
              <template #default="{ row }">{{ row.marginRate != null ? (row.marginRate * 100).toFixed(1) + '%' : '—' }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <p class="hint">
      数据为演示口径代表值（前端 mock 与后端 ReportsService 同口径）；真实聚合由 §10 双价列 + §16 ledger + 订单/运单事件支撑，详见方案 §25。
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { EChartsOption } from 'echarts'
import { reportsApi, type ReportDashboard } from '@/api/reports'
import BaseChart from '@/components/BaseChart.vue'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 运营报表页（任务 4.7，方案 §25）：五类指标单请求聚合渲染，演示+正式双路通。
const dashboard = ref<ReportDashboard | null>(null)
const loading = ref(false)

function fmt(n: number): string {
  return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fulfillmentText = computed(() => {
  const r = dashboard.value?.fulfillmentSla.overallAchievedRate
  return r == null ? '—' : (r * 100).toFixed(1) + '%'
})
const exceptionText = computed(() => {
  const r = dashboard.value?.exceptionRate.overallRate
  return r == null ? '—' : (r * 100).toFixed(1) + '%'
})
const profitTotalText = computed(() => {
  const t = dashboard.value?.profit.trend.reduce((a, p) => a + p.spread, 0) ?? 0
  return '¥' + t.toLocaleString('zh-CN')
})
const totalOrdersText = computed(() => {
  const c = dashboard.value?.channelDistribution.items.reduce((a, i) => a + i.orderCount, 0) ?? 0
  return c.toLocaleString('zh-CN') + ' 单'
})

// 履约时效各段平均时长
const fulfillmentOption = computed<EChartsOption>(() => {
  const stages = dashboard.value?.fulfillmentSla.stages ?? []
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 30 },
    xAxis: { type: 'category', data: stages.map((s) => s.label) },
    yAxis: { type: 'value', name: '小时' },
    series: [
      {
        type: 'bar',
        data: stages.map((s) => s.avgHours),
        itemStyle: { color: '#4F6EF7' },
        barWidth: '46%',
        label: { show: true, position: 'top', formatter: (p: any) => p.value + 'h' },
      },
    ],
  }
})

// 物流时效：平均时效(bar) + 异常率(line, %)
const logisticsOption = computed<EChartsOption>(() => {
  const ch = dashboard.value?.logisticsSla.channels ?? []
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: ['平均时效', '异常率'], bottom: 0 },
    grid: { left: 44, right: 48, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: ch.map((c) => c.carrierName) },
    yAxis: [
      { type: 'value', name: '天' },
      { type: 'value', name: '%', axisLabel: { formatter: (v: any) => (v * 100).toFixed(1) + '%' } },
    ],
    series: [
      { name: '平均时效', type: 'bar', data: ch.map((c) => c.avgTransitDays), itemStyle: { color: '#4F6EF7' }, barWidth: '42%' },
      { name: '异常率', type: 'line', yAxisIndex: 1, data: ch.map((c) => c.exceptionRate), itemStyle: { color: '#EF4444' } },
    ],
  }
})

// 利润趋势：spread(bar) + 应收/应付(line)
const profitOption = computed<EChartsOption>(() => {
  const t = dashboard.value?.profit.trend ?? []
  return {
    tooltip: { trigger: 'axis', valueFormatter: (v: any) => '¥' + Number(v).toLocaleString('zh-CN') },
    legend: { data: ['平台利润', '应收', '应付'], bottom: 0 },
    grid: { left: 60, right: 20, top: 24, bottom: 40 },
    xAxis: { type: 'category', data: t.map((p) => p.period) },
    yAxis: { type: 'value', axisLabel: { formatter: (v: any) => '¥' + (v / 10000).toFixed(0) + 'w' } },
    series: [
      { name: '平台利润', type: 'bar', data: t.map((p) => p.spread), itemStyle: { color: '#12B5A5' }, barWidth: '40%' },
      { name: '应收', type: 'line', smooth: true, data: t.map((p) => p.totalSell), itemStyle: { color: '#4F6EF7' } },
      { name: '应付', type: 'line', smooth: true, data: t.map((p) => p.totalCost), itemStyle: { color: '#F59E0B' } },
    ],
  }
})

// 渠道分布单量占比饼图
const channelPieOption = computed<EChartsOption>(() => {
  const items = dashboard.value?.channelDistribution.items ?? []
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        data: items.map((i) => ({ name: i.carrierName, value: i.orderCount })),
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  }
})

// 异常构成饼图
const exceptionPieOption = computed<EChartsOption>(() => {
  const items = dashboard.value?.exceptionRate.items ?? []
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0 },
    color: ['#F59E0B', '#EF4444', '#9CA3AF'],
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        data: items.map((i) => ({ name: i.label, value: i.count })),
        label: { formatter: '{b}\n{d}%' },
      },
    ],
  }
})

// 利润拆解表（租户 + 渠道合并行）
const profitTableRows = computed(() => {
  const d = dashboard.value
  if (!d) return []
  const tenantRows = d.profit.byTenant.map((t) => ({ dim: '租户', name: t.tenantName, margin: t.margin, marginRate: t.marginRate }))
  const channelRows = d.profit.byChannel.map((c) => ({ dim: '渠道', name: c.carrierName, margin: c.margin, marginRate: null }))
  return [...tenantRows, ...channelRows]
})

async function load(): Promise<void> {
  loading.value = true
  try {
    dashboard.value = await reportsApi.overview()
  } catch (e) {
    console.warn('[Reports] 加载失败', (e as Error).message)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.stat-card {
  border-radius: var(--r-lg);
}
.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-ico {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.stat-label {
  font-size: 13px;
  color: var(--ink-500);
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink-900);
  line-height: 1.2;
}
.stat-sub {
  font-size: 12px;
  color: var(--ink-400);
}
.chart-card {
  margin-bottom: 16px;
  border-radius: var(--r-lg);
}
.card-title {
  font-weight: 600;
  color: var(--ink-800);
}
.money {
  color: var(--brand-600);
}
.hint {
  font-size: 12px;
  color: var(--ink-400);
  margin: 4px 2px 0;
}
</style>
