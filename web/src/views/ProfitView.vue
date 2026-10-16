<template>
  <div class="profit">
    <PageHeader
      title="利润核算（spread）"
      subtitle="§9 平台利润 = Σ sell_price − Σ carrier_cost，按租户 / 承运商多维拆解"
      icon="trend"
      accent="brand"
    >
      <template #actions>
        <el-input v-model="period" placeholder="账期 YYYY-MM" class="period-input" size="default">
          <template #prefix><AppIcon name="calendar" :size="14" /></template>
        </el-input>
      </template>
    </PageHeader>

    <!-- 利润总览 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-sell"><AppIcon name="arrow-down" :size="20" /></div>
          <div class="stat-label">应收合计（商户账单）</div>
          <div class="stat-value">{{ fmt(breakdown?.summary.totalSell) }}</div>
          <div class="stat-sub">Σ sell_price</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-cost"><AppIcon name="arrow-up" :size="20" /></div>
          <div class="stat-label">应付合计（承运商对账）</div>
          <div class="stat-value">{{ fmt(breakdown?.summary.totalCost) }}</div>
          <div class="stat-sub">Σ carrier_cost</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card stat-profit" shadow="hover">
          <div class="stat-ico ico-profit"><AppIcon name="coins" :size="20" /></div>
          <div class="stat-label">平台利润</div>
          <div class="stat-value" :class="isNeg(breakdown?.summary.profit) ? 'amt-neg' : 'amt-pos'">
            {{ fmt(breakdown?.summary.profit) }}
          </div>
          <div class="stat-sub">应收 − 应付</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-ico ico-margin"><AppIcon name="percent" :size="20" /></div>
          <div class="stat-label">毛利率</div>
          <div class="stat-value">{{ marginText }}</div>
          <div class="stat-sub">{{ breakdown ? breakdown.summary.billCount : 0 }} 账单 · {{ breakdown ? breakdown.summary.reconciliationCount : 0 }} 对账</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 左：利润趋势图 -->
      <el-col :span="14">
        <el-card v-loading="loading" class="chart-card" shadow="never">
          <template #header><span class="section-title">利润趋势（近 6 账期）</span></template>
          <div ref="chartEl" class="chart"></div>
        </el-card>
      </el-col>

      <!-- 右：按租户利润贡献 -->
      <el-col :span="10">
        <el-card v-loading="loading" class="break-card" shadow="never">
          <template #header><span class="section-title">按租户利润贡献（{{ period }}）</span></template>
          <el-table :data="breakdown?.byTenant || []" class="break-table" empty-text="暂无数据">
            <el-table-column label="租户" prop="tenantId" min-width="120" />
            <el-table-column label="应收" width="110">
              <template #default="{ row }"><span class="amt amt-pos">{{ fmt(row.totalSell) }}</span></template>
            </el-table-column>
            <el-table-column label="应付" width="110">
              <template #default="{ row }"><span class="amt amt-neg">{{ fmt(row.totalCost) }}</span></template>
            </el-table-column>
            <el-table-column label="利润" width="110">
              <template #default="{ row }">
                <span :class="['amt', row.profit < 0 ? 'amt-neg' : 'amt-pos']">{{ fmt(row.profit) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="毛利率" width="90">
              <template #default="{ row }">{{ (row.marginRate * 100).toFixed(1) }}%</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 按承运商成本 -->
    <el-card v-loading="loading" class="break-card carrier-card" shadow="never">
      <template #header><span class="section-title">按承运商应付成本（{{ period }}）</span></template>
      <el-table :data="breakdown?.byCarrier || []" class="break-table" empty-text="暂无数据">
        <el-table-column label="承运商" prop="carrierCode" min-width="160" />
        <el-table-column label="应付成本" width="160">
          <template #default="{ row }"><span class="amt amt-neg">{{ fmt(row.totalCost) }}</span></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { billingApi, type ProfitBreakdown, type ProfitSummary } from '@/api/billing'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 利润核算页（任务 4.3，方案 §9 spread 报表化）：总览 + 趋势 + 租户/承运商拆解。
const period = ref('2026-10')
const breakdown = ref<ProfitBreakdown | null>(null)
const loading = ref(false)
const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function fmt(n?: number): string {
  return '¥' + (n ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function isNeg(n?: number): boolean {
  return (n ?? 0) < 0
}
const marginText = computed(() => {
  if (!breakdown.value) return '—'
  return (breakdown.value.summary.marginRate * 100).toFixed(1) + '%'
})

async function refresh(): Promise<void> {
  loading.value = true
  try {
    const [bd, trend] = await Promise.all([
      billingApi.getProfitBreakdown(period.value),
      billingApi.getProfitTrend(6),
    ])
    breakdown.value = bd
    renderChart(trend)
  } catch (e) {
    // 静默：演示态下 chart 数据仍可用
    console.warn('[Profit] 加载失败', (e as Error).message)
  } finally {
    loading.value = false
  }
}

function renderChart(trend: ProfitSummary[]): void {
  if (!chartEl.value) return
  if (!chart) chart = echarts.init(chartEl.value)
  const periods = trend.map((p) => p.period)
  const profits = trend.map((p) => Number(p.profit.toFixed(2)))
  const sells = trend.map((p) => Number(p.totalSell.toFixed(2)))
  const costs = trend.map((p) => Number(p.totalCost.toFixed(2)))
  const option = {
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => '¥' + Number(v).toLocaleString('zh-CN') },
    legend: { data: ['平台利润', '应收', '应付'], bottom: 0 },
    grid: { left: 56, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: periods },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => '¥' + (v / 1000).toFixed(0) + 'k' } },
    series: [
      {
        name: '平台利润',
        type: 'bar',
        data: profits,
        itemStyle: { color: '#4F6EF7' },
        barWidth: '42%',
      },
      { name: '应收', type: 'line', smooth: true, data: sells, itemStyle: { color: '#12B5A5' } },
      { name: '应付', type: 'line', smooth: true, data: costs, itemStyle: { color: '#EF4444' } },
    ],
  }
  chart.setOption(option as echarts.EChartsOption)
  chart.resize()
}

function resizeHandler(): void {
  chart?.resize()
}

onMounted(() => {
  refresh()
  window.addEventListener('resize', resizeHandler)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler)
  chart?.dispose()
  chart = null
})

// 切换账期重新拉取明细（趋势固定近 6 期，不随账期变化）
watch(period, () => {
  nextTick(() => refresh())
})
</script>

<style scoped>
.period-input {
  width: 150px;
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
.chart-card,
.break-card {
  border-radius: var(--r-lg);
}
.chart-card {
  margin-bottom: 16px;
}
.chart {
  width: 100%;
  height: 320px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.carrier-card {
  margin-top: 16px;
}
.break-table :deep(.el-tag) {
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
