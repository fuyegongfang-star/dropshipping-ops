<template>
  <div ref="el" class="base-chart" :style="{ height }"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

/**
 * 轻量 ECharts 封装：统一负责 init / setOption / resize / dispose，
 * 避免每个看板页重复样板（ProfitView 等可后续迁移复用）。
 */
const props = withDefaults(
  defineProps<{ option: echarts.EChartsOption; height?: string }>(),
  { height: '300px' },
)

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function render(): void {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  chart.setOption(props.option, true)
  chart.resize()
}

onMounted(() => nextTick(render))
watch(() => props.option, () => render(), { deep: true })

function resize(): void {
  chart?.resize()
}
window.addEventListener('resize', resize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.base-chart {
  width: 100%;
}
</style>
