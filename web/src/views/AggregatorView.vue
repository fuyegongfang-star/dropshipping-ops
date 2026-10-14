<template>
  <div class="aggregator">
    <PageHeader
      title="聚合追踪（兜底通道）"
      subtitle="承运商直连失败时，经 AfterShip / 17TRACK 等聚合平台统一归一化尾程轨迹，作为第三通道兜底（§3e）"
      icon="radar"
      accent="teal"
    >
      <template #actions>
        <span class="pill"><AppIcon name="radar" :size="13" />§3e 聚合平台兜底</span>
      </template>
    </PageHeader>

    <el-row :gutter="16">
      <!-- 左：查询 -->
      <el-col :span="9">
        <el-card class="form-card">
          <template #header><span class="section-title">聚合追踪查询</span></template>
          <el-form label-position="top">
            <el-form-item label="聚合平台">
              <el-select v-model="form.aggregatorCode" class="w-full" placeholder="选择聚合平台">
                <el-option v-for="a in aggregators" :key="a.code" :label="a.name" :value="a.code" />
              </el-select>
            </el-form-item>
            <el-form-item label="尾程承运商">
              <el-select v-model="form.carrierCode" class="w-full" placeholder="选择尾程承运商">
                <el-option v-for="c in carriers" :key="c.code" :label="c.name" :value="c.code" />
              </el-select>
            </el-form-item>
            <el-form-item label="运单 / 轨迹号">
              <el-input v-model="form.trackingNo" placeholder="如 TRK123456（含 fail 演示未解析兜底）" />
            </el-form-item>
            <div class="actions">
              <el-button type="primary" :loading="loading" @click="onTrack">
                <AppIcon name="radar" :size="15" /> 聚合查询
              </el-button>
              <el-button @click="fillSample()"><AppIcon name="check" :size="15" /> 填充示例</el-button>
            </div>
          </el-form>
          <el-alert
            class="tip"
            type="info"
            :closable="false"
            title="何时用聚合兜底？"
            description="承运商直连轨迹失败 / 尾程多承运商分散时，用聚合平台一次性归一化。直连成功时优先直连（§6），聚合仅作兜底。"
          />
        </el-card>
      </el-col>

      <!-- 右：结果 -->
      <el-col :span="15">
        <el-empty v-if="!result && !error" description="选择聚合平台与尾程承运商，输入轨迹号后点击「聚合查询」" />
        <el-alert v-if="error" type="error" :closable="false" :title="error" class="mb" />

        <template v-if="result">
          <el-card class="res-card">
            <template #header>
              <span class="section-title">
                {{ result.aggregatorName }} · {{ result.trackingNo }}
                <el-tag :type="result.fallback ? 'warning' : 'success'" size="small" class="ml">
                  {{ result.fallback ? '未解析·建议直连兜底' : '归一化成功' }}
                </el-tag>
              </span>
            </template>

            <div class="meta">
              <span><i>尾程承运商</i><b>{{ result.carrierCode }}</b></span>
              <span><i>聚合平台</i><b>{{ result.aggregatorName }}</b></span>
              <span><i>状态</i><b>{{ result.status }}</b></span>
            </div>
            <p class="note">{{ result.note }}</p>

            <el-timeline class="tl">
              <el-timeline-item
                v-for="(ev, i) in result.events"
                :key="i"
                :type="ev.status === 'exception' ? 'danger' : 'primary'"
                :hollow="ev.status === 'exception'"
              >
                <div class="ev">
                  <b>{{ ev.description }}</b>
                  <small class="muted">{{ ev.location ? ev.location + ' · ' : '' }}{{ ev.occurredAt }}</small>
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </template>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import {
  carriersApi,
  type AggregatorQuery,
  type AggregatorResult,
  type AggregatorCatalogItem,
} from '@/api/carriers'

const aggregators = ref<AggregatorCatalogItem[]>([])
const carriers = ref<{ code: string; name: string }[]>([])
const loading = ref(false)
const result = ref<AggregatorResult | null>(null)
const error = ref('')

const form = reactive<AggregatorQuery>({
  aggregatorCode: 'aftership',
  carrierCode: 'dhl',
  trackingNo: '',
})

function fillSample(): void {
  Object.assign(form, { aggregatorCode: 'aftership', carrierCode: 'dhl', trackingNo: 'TRK123456' })
}

async function onTrack(): Promise<void> {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await carriersApi.aggregateTrack({ ...form })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '聚合查询失败'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    ;[aggregators.value, carriers.value] = await Promise.all([
      carriersApi.listAggregators(),
      carriersApi.list(),
    ])
  } catch {
    aggregators.value = []
    carriers.value = []
  }
})
</script>

<style scoped>
.w-full {
  width: 100%;
}
.section-title {
  font-weight: 600;
  color: var(--ink-800);
}
.ml {
  margin-left: 8px;
}
.mb {
  margin-bottom: 16px;
}
.form-card {
  margin-bottom: 16px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--r-pill);
  background: var(--teal-soft, #d8f5f0);
  color: #0f8f82;
  font-size: 12px;
  font-weight: 600;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tip {
  margin-top: 14px;
}
.meta {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.meta i {
  font-style: normal;
  color: var(--ink-500);
  font-size: 13px;
  margin-right: 6px;
}
.meta b {
  color: var(--ink-800);
}
.note {
  font-size: 13.5px;
  color: var(--ink-600);
  background: var(--line-soft);
  padding: 8px 12px;
  border-radius: 10px;
  margin: 0 0 12px;
}
.tl {
  padding-left: 4px;
}
.ev {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ev b {
  font-size: 14px;
  color: var(--ink-800);
}
.muted {
  color: var(--ink-500);
}
</style>
