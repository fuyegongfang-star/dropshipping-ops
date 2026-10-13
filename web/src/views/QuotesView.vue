<template>
  <div class="quotes">
    <PageHeader
      title="运费试算门户"
      subtitle="输入重量与尺寸，按目的国实时比价 · 展示加价后的客户售价"
      icon="calculator"
      accent="brand"
    >
      <template #actions>
        <span class="cur-pill"><AppIcon name="coins" :size="13" />结算币种 USD</span>
      </template>
    </PageHeader>

    <el-row :gutter="16">
      <!-- 左：试算表单 -->
      <el-col :span="8">
        <el-card class="form-card">
          <template #header><span class="section-title">试算参数</span></template>

          <el-form label-position="top">
            <el-form-item label="目的国">
              <el-select v-model="form.country" class="w-full">
                <el-option
                  v-for="c in countries"
                  :key="c.code"
                  :label="c.name"
                  :value="c.code"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="重量 (g)">
              <el-input-number v-model="form.weightG" class="w-full" :min="1" :max="50000" :step="50" />
            </el-form-item>

            <el-form-item label="尺寸 长 × 宽 × 高 (cm)">
              <el-row :gutter="8" class="dims">
                <el-col :span="8">
                  <el-input-number v-model="form.lengthCm" class="w-full" :min="1" :max="200" />
                </el-col>
                <el-col :span="8">
                  <el-input-number v-model="form.widthCm" class="w-full" :min="1" :max="200" />
                </el-col>
                <el-col :span="8">
                  <el-input-number v-model="form.heightCm" class="w-full" :min="1" :max="200" />
                </el-col>
              </el-row>
            </el-form-item>

            <el-form-item label="货物类型">
              <el-radio-group v-model="form.category">
                <el-radio-button v-for="c in categories" :key="c.value" :value="c.value">
                  {{ c.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="申报价值 (USD)">
              <el-input-number v-model="form.declaredValue" class="w-full" :min="0" :max="100000" />
            </el-form-item>

            <el-button type="primary" class="w-full run-btn" :loading="loading" @click="run">
              <AppIcon name="bolt" :size="15" class="btn-ico" />立即试算
            </el-button>
          </el-form>

          <p class="text-hint form-hint">
            计费重取「实重」与「体积重(长×宽×高/5000)」较大者；
            选择禁运国（KP / IR）可观察 L2 可达性剔除效果。
          </p>
        </el-card>
      </el-col>

      <!-- 右：比价结果 -->
      <el-col :span="16">
        <el-card v-loading="loading" class="result-card">
          <template #header>
            <div class="card-head">
              <span class="section-title">比价结果</span>
              <span v-if="result" class="count-pill">
                计费重 {{ result.chargeableG }} g · {{ result.lines.length }} 家渠道
              </span>
            </div>
          </template>

          <template v-if="result">
            <!-- 引擎四层执行痕迹 -->
            <div class="trace">
              <div v-for="t in result.trace" :key="t.layer" class="trace-row">
                <span class="trace-layer">{{ t.layer }}</span>
                <span class="trace-detail">{{ t.detail }}</span>
              </div>
            </div>

            <template v-if="result.lines.length">
              <div class="price-head">
                <span>渠道 / 时效</span>
                <span>加价率</span>
                <span class="ph-right">成本 → <b>客户售价</b></span>
              </div>

              <div
                v-for="(line, idx) in result.lines"
                :key="keyOf(line)"
                class="quote"
                :class="{ picked: selectedKey === keyOf(line) }"
              >
                <div class="q-left">
                  <span class="q-rank">{{ idx + 1 }}</span>
                  <div class="q-name">
                    <span class="q-carrier">{{ line.carrierName }}</span>
                    <span class="q-product">{{ line.productName }}</span>
                    <span v-if="idx === 0" class="tag-soft tag-green">最低价</span>
                  </div>
                  <div class="q-meta">
                    <AppIcon name="clock" :size="13" />{{ line.transitDays }} 天 ·
                    {{ line.productCode }}
                  </div>
                </div>

                <div class="q-mid">
                  <span class="tag-soft tag-brand">+{{ line.markupRate }}%</span>
                </div>

                <div class="q-right">
                  <div class="q-price">
                    <span class="q-cost">${{ line.costPrice.toFixed(2) }}</span>
                    <AppIcon name="arrowRight" :size="15" class="q-arrow" />
                    <span class="q-sell">${{ line.sellPrice.toFixed(2) }}</span>
                  </div>
                  <el-button size="small" type="primary" plain @click="pick(line)">选择渠道</el-button>
                </div>
              </div>

              <p class="text-hint result-hint">
                售价 = 成本 × (1 + 加价率)，即平台客户实际看到的报价；加价规则可在「加价 / 币种」页查看。
              </p>
            </template>

            <div v-else class="app-empty">
              <span class="app-empty-ico"><AppIcon name="warning" :size="26" /></span>
              <span class="app-empty-text">该目的国命中禁运清单，无可用渠道（L2 已剔除）</span>
            </div>
          </template>

          <div v-else class="app-empty">
            <span class="app-empty-ico"><AppIcon name="calculator" :size="26" /></span>
            <span class="app-empty-text">填写左侧参数并点击「立即试算」，查看各承运商报价</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import {
  pricingApi,
  CATEGORY_LABELS,
  type GoodsCategory,
  type QuoteLine,
  type CompareResult,
} from '@/api/pricing'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

// 运费试算门户（阶段3.5 比价引擎 + 3.6 加价 + 3.7 渠道自选）。
const countries = [
  { code: 'US', name: '美国 US' },
  { code: 'GB', name: '英国 GB' },
  { code: 'DE', name: '德国 DE' },
  { code: 'FR', name: '法国 FR' },
  { code: 'JP', name: '日本 JP' },
  { code: 'AU', name: '澳大利亚 AU' },
  { code: 'KP', name: '朝鲜 KP（禁运演示）' },
  { code: 'IR', name: '伊朗 IR（禁运演示）' },
]

const categories = Object.keys(CATEGORY_LABELS).map((k) => ({
  value: k as GoodsCategory,
  label: CATEGORY_LABELS[k as GoodsCategory],
}))

const form = reactive({
  country: 'US',
  weightG: 500,
  lengthCm: 20,
  widthCm: 15,
  heightCm: 10,
  category: 'normal' as GoodsCategory,
  declaredValue: 120,
})

const loading = ref(false)
const result = ref<CompareResult | null>(null)
const selectedKey = ref('')

function keyOf(line: QuoteLine): string {
  return line.carrierCode + ':' + line.productCode
}

async function run(): Promise<void> {
  loading.value = true
  selectedKey.value = ''
  try {
    result.value = await pricingApi.compare({ ...form })
  } catch (e) {
    ElMessage.error('试算失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

function pick(line: QuoteLine): void {
  selectedKey.value = keyOf(line)
  ElMessage.success(
    `已选择 ${line.carrierName} · ${line.productName}，客户售价 $${line.sellPrice.toFixed(2)}（时效 ${line.transitDays} 天）`,
  )
}
</script>

<style scoped>
.w-full {
  width: 100%;
}
.btn-ico {
  margin-right: 5px;
}
.cur-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink-600);
  font-size: 13px;
  font-weight: 500;
}
.form-card :deep(.el-card__body) {
  padding: 18px 20px;
}
.dims {
  width: 100%;
}
.dims :deep(.el-input-number) {
  width: 100%;
}
.run-btn {
  margin-top: 4px;
}
.form-hint {
  margin: 14px 0 0;
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
  color: var(--brand-700);
  background: var(--brand-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}

/* 引擎四层痕迹 */
.trace {
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  background: #f8fafc;
  padding: 10px 14px;
  margin-bottom: 18px;
}
.trace-row {
  display: flex;
  gap: 12px;
  padding: 5px 0;
  font-size: 12.5px;
  line-height: 1.6;
}
.trace-layer {
  flex: none;
  width: 96px;
  font-weight: 600;
  color: var(--brand-700);
}
.trace-detail {
  color: var(--ink-600);
}

/* 价格表头 */
.price-head {
  display: flex;
  align-items: center;
  padding: 0 14px 8px;
  font-size: 12px;
  color: var(--ink-400);
}
.price-head span:first-child {
  flex: 1;
}
.price-head span:nth-child(2) {
  width: 96px;
  text-align: center;
}
.ph-right {
  width: 260px;
  text-align: right;
}
.ph-right b {
  color: var(--ink-600);
}

/* 单条报价 */
.quote {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  margin-bottom: 10px;
  transition: all 0.18s var(--ease);
}
.quote:hover {
  border-color: var(--brand-400);
  box-shadow: var(--sh-1);
}
.quote.picked {
  border-color: var(--brand-500);
  background: var(--brand-soft);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.14);
}
.q-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.q-rank {
  width: 24px;
  height: 24px;
  flex: none;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.q-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.q-carrier {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ink-900);
}
.q-product {
  font-size: 12.5px;
  color: var(--ink-500);
}
.q-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--ink-500);
}
.q-mid {
  width: 96px;
  text-align: center;
  flex: none;
}
.q-right {
  width: 260px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}
.q-price {
  display: flex;
  align-items: center;
  gap: 8px;
}
.q-cost {
  font-size: 13px;
  color: var(--ink-400);
  text-decoration: line-through;
}
.q-arrow {
  color: var(--ink-300);
}
.q-sell {
  font-size: 20px;
  font-weight: 700;
  color: var(--brand-600);
  letter-spacing: -0.5px;
}
.result-hint {
  margin: 6px 0 0;
}
</style>
