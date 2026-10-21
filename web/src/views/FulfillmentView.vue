<template>
  <div class="fulfillment">
    <PageHeader
      title="履约路由"
      subtitle="1.5 模式A 自动选渠道（§4/§5）：给定发货上下文与策略，系统自动挑最优承运商"
      icon="swap"
      accent="brand"
    />

    <el-row :gutter="16">
      <!-- 左：发货上下文表单 -->
      <el-col :span="9">
        <el-card class="form-card" shadow="never">
          <template #header><span class="section-title">发货上下文</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="目的国（ISO2）">
              <el-input v-model="form.destCountry" placeholder="如 US / GB / DE" />
            </el-form-item>
            <el-form-item label="货物类型">
              <el-select v-model="form.cargoType" class="full">
                <el-option v-for="(label, code) in CARGO_LABELS" :key="code" :label="label" :value="code" />
              </el-select>
            </el-form-item>
            <el-form-item label="包裹实重（kg）">
              <el-input-number v-model="form.weightKg" :min="0.01" :step="0.5" :precision="2" class="full" />
            </el-form-item>
            <el-form-item label="长 / 宽 / 高（cm）">
              <div class="dims">
                <el-input-number v-model="form.lengthCm" :min="1" :step="1" controls-position="right" />
                <el-input-number v-model="form.widthCm" :min="1" :step="1" controls-position="right" />
                <el-input-number v-model="form.heightCm" :min="1" :step="1" controls-position="right" />
              </div>
            </el-form-item>
            <el-form-item label="选渠策略">
              <el-radio-group v-model="form.strategy">
                <el-radio-button value="cheapest">最省钱</el-radio-button>
                <el-radio-button value="fastest">最快</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-button type="primary" class="full" :loading="loading" @click="runRoute">
              <AppIcon name="bolt" :size="15" /> 自动选渠道
            </el-button>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右：推荐结果 -->
      <el-col :span="15">
        <el-card v-if="result" class="result-card" shadow="never">
          <template #header>
            <span class="section-title">自动推荐</span>
            <span class="strategy-tag">{{ STRATEGY_LABELS[result.strategy] }}</span>
          </template>

          <div v-if="result.recommended" class="rec">
            <div class="rec-ico"><AppIcon name="check" :size="22" /></div>
            <div class="rec-main">
              <div class="rec-name">{{ result.recommended.productName }}</div>
              <div class="rec-sub">{{ result.recommended.carrierCode }} · 计费重 {{ result.recommended.chargeableWeightKg }}kg</div>
            </div>
            <div class="rec-price">
              <div class="rec-sell">${{ result.recommended.sellPrice?.toFixed(2) }}</div>
              <div class="rec-cost">成本 ${{ result.recommended.carrierCost.toFixed(2) }}</div>
            </div>
            <div class="rec-lead">
              {{ result.recommended.estimatedLeadDaysMin }}-{{ result.recommended.estimatedLeadDaysMax }} 工作日
            </div>
          </div>

          <el-alert :title="result.rationale" type="info" :closable="false" class="rationale" />

          <div v-if="result.alternatives.length" class="alt-title">备选渠道</div>
          <el-table v-if="result.alternatives.length" :data="result.alternatives" class="alt-table">
            <el-table-column label="物流产品" prop="productName" min-width="160" />
            <el-table-column label="售价(USD)" width="110">
              <template #default="{ row }"><span class="mono">${{ row.sellPrice?.toFixed(2) }}</span></template>
            </el-table-column>
            <el-table-column label="时效" width="120">
              <template #default="{ row }">{{ row.estimatedLeadDaysMin }}-{{ row.estimatedLeadDaysMax }} 天</template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-empty v-else description="填写发货上下文后点击「自动选渠道」" :image-size="90" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { fulfillmentApi, type RouteSuggestion, type RouteStrategy, STRATEGY_LABELS } from '@/api/fulfillment'
import { CARGO_LABELS } from '@/api/pricing'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { ElMessage } from 'element-plus'

// 履约路由页（任务 1.5，方案 §4/§5 模式A 自动选渠道）：给定订单发货上下文与策略，自动挑最优渠道。
const form = reactive({
  destCountry: 'US',
  cargoType: 'normal',
  weightKg: 0.5,
  lengthCm: 20,
  widthCm: 15,
  heightCm: 10,
  strategy: 'cheapest' as RouteStrategy,
})

const loading = ref(false)
const result = ref<RouteSuggestion | null>(null)

async function runRoute(): Promise<void> {
  loading.value = true
  try {
    result.value = await fulfillmentApi.route({
      destCountry: form.destCountry.trim().toUpperCase(),
      parcels: [{ weightKg: form.weightKg, lengthCm: form.lengthCm, widthCm: form.widthCm, heightCm: form.heightCm }],
      cargoType: form.cargoType,
      strategy: form.strategy,
    })
  } catch (e) {
    ElMessage.error(`路由失败：${(e as Error).message}`)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form-card,
.result-card {
  border-radius: var(--r-lg);
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.full {
  width: 100%;
}
.dims {
  display: flex;
  gap: 8px;
}
.dims :deep(.el-input-number) {
  flex: 1;
}
.strategy-tag {
  float: right;
  font-size: 12px;
  font-weight: 600;
  color: var(--brand-700);
  background: var(--brand-soft);
  border-radius: 999px;
  padding: 2px 10px;
}
.rec {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: var(--r-md);
  background: linear-gradient(135deg, rgba(79, 110, 247, 0.08), rgba(79, 110, 247, 0.02));
  border: 1px solid rgba(79, 110, 247, 0.18);
  margin-bottom: 14px;
}
.rec-ico {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  box-shadow: var(--sh-brand);
  flex: none;
}
.rec-main {
  flex: 1;
}
.rec-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-900);
}
.rec-sub {
  font-size: 12px;
  color: var(--ink-500);
}
.rec-price {
  text-align: right;
}
.rec-sell {
  font-size: 18px;
  font-weight: 800;
  color: var(--brand-700);
}
.rec-cost {
  font-size: 12px;
  color: var(--ink-400);
}
.rec-lead {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-700);
  white-space: nowrap;
}
.rationale {
  margin-bottom: 14px;
}
.alt-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-800);
  margin: 6px 0 10px;
}
.mono {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 600;
}
</style>
