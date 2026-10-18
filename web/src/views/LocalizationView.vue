<template>
  <div class="loc">
    <PageHeader
      :title="t('menu.localization')"
      :subtitle="subtitle"
      icon="globe"
      accent="brand"
    />

    <el-alert
      class="hint"
      type="info"
      :closable="false"
      show-icon
      :title="t('menu.localization') + ' · 方案 §27'"
      :description="hintText"
    />

    <el-row :gutter="16">
      <!-- 语言 -->
      <el-col :span="12">
        <el-card class="cfg-card" shadow="never">
          <template #header><span class="section-title">{{ t('topbar.language') }}</span></template>
          <el-radio-group :model-value="locale" @change="onLangChange">
            <el-radio-button v-for="(label, code) in LOCALE_LABELS" :key="code" :value="code">
              {{ label }}
            </el-radio-button>
          </el-radio-group>
          <p class="tip">{{ langTip }}</p>
        </el-card>
      </el-col>

      <!-- 展示币种 -->
      <el-col :span="12">
        <el-card class="cfg-card" shadow="never">
          <template #header><span class="section-title">{{ t('topbar.currency') }}</span></template>
          <el-radio-group :model-value="displayCurrency" @change="onCurrencyChange">
            <el-radio-button v-for="(label, code) in CURRENCY_LABELS" :key="code" :value="code">
              {{ label }}
            </el-radio-button>
          </el-radio-group>
          <p class="tip">{{ currencyTip }}</p>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <!-- 汇率表（§10.3 口径，基准币 CNY） -->
      <el-col :span="14">
        <el-card class="cfg-card" shadow="never">
          <template #header><span class="section-title">{{ rateTableTitle }}</span></template>
          <el-table :data="rateRows" class="rate-table" empty-text="—">
            <el-table-column :label="curCol" prop="code" min-width="120" />
            <el-table-column :label="symCol" prop="symbol" width="90" />
            <el-table-column :label="rateCol" prop="toCny" width="150">
              <template #default="{ row }">
                <span class="mono">1 {{ row.code }} = ¥{{ row.toCny }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="invCol" prop="fromCny" width="150">
              <template #default="{ row }">
                <span class="mono">¥1 = {{ row.fromCny }} {{ row.code }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 换算演示 -->
      <el-col :span="10">
        <el-card class="cfg-card" shadow="never">
          <template #header><span class="section-title">{{ convertTitle }}</span></template>
          <div class="conv-input">
            <span class="conv-label">CNY</span>
            <el-input-number
              v-model="convertAmount"
              :min="0"
              :precision="2"
              :step="100"
              controls-position="right"
              class="full"
            />
          </div>
          <div class="conv-list">
            <div v-for="(label, code) in CURRENCY_LABELS" :key="code" class="conv-row">
              <span class="conv-code">{{ code }}</span>
              <span class="conv-val mono">{{ convertTo(code) }}</span>
            </div>
          </div>
          <p class="tip">{{ convTip }}</p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  t,
  locale,
  displayCurrency,
  setLocale,
  setCurrency,
  FX_RATES,
  CURRENCY_SYMBOLS,
  CURRENCY_LABELS,
  LOCALE_LABELS,
  type Locale,
  type CurrencyCode,
} from '@/locales'
import PageHeader from '@/components/PageHeader.vue'

// 本地化设置页（任务 4.9，方案 §27）：语言 + 展示币种 + 汇率表 + 换算演示。
// 记账 / 后端始终以基准币 CNY 存储，前端按展示币种换算（§27）。

const convertAmount = ref(1000)

const subtitle = computed(() =>
  locale.value === 'en'
    ? 'i18n (中文 / English) + merchant display currency conversion (§27). Accounting stays in base currency CNY.'
    : 'i18n（中 / 英）+ 商户本地币展示（§27）：记账与后端始终以基准币 CNY 存储，前端按展示币种换算。',
)
const hintText = computed(() =>
  locale.value === 'en'
    ? 'All amounts are stored in base currency CNY in backend/ledger; the frontend only converts for display. Toggle currency in the top bar to see finance pages update live.'
    : '所有金额在后端 / 账本中以基准币 CNY 存储；前端仅做展示换算。顶栏切换展示币种，财务类页面将即时按所选币种显示。',
)
const langTip = computed(() =>
  locale.value === 'en' ? 'Switch the UI language across navigation and settings instantly.' : '即时切换导航与界面文案（中文 / English）。',
)
const currencyTip = computed(() =>
  locale.value === 'en' ? 'Finance pages (e.g. Profit) show amounts in this currency.' : '财务类页面（如利润核算）将按所选币种展示金额。',
)
const rateTableTitle = computed(() => (locale.value === 'en' ? 'FX Rates (base CNY · §10.3)' : '汇率表（基准币 CNY · §10.3）'))
const curCol = computed(() => (locale.value === 'en' ? 'Currency' : '币种'))
const symCol = computed(() => (locale.value === 'en' ? 'Symbol' : '符号'))
const rateCol = computed(() => (locale.value === 'en' ? '→ CNY' : '兑换基准币'))
const invCol = computed(() => (locale.value === 'en' ? 'CNY →' : '基准币 →'))
const convertTitle = computed(() => (locale.value === 'en' ? 'Convert Demo' : '换算演示'))
const convTip = computed(() =>
  locale.value === 'en'
    ? 'Numbers above use each currency\'s symbol and converted value; base amount is CNY.'
    : '上方按各币种符号与换算值展示；基准金额始终为 CNY。',
)

const rateRows = computed(() =>
  (Object.keys(CURRENCY_LABELS) as CurrencyCode[]).map((code) => {
    const toCny = FX_RATES[code]
    return {
      code,
      symbol: CURRENCY_SYMBOLS[code],
      toCny,
      fromCny: (1 / toCny).toFixed(4),
    }
  }),
)

function convertTo(code: CurrencyCode): string {
  const v = toDisplayFor(convertAmount.value, code)
  return CURRENCY_SYMBOLS[code] + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
// 指定币种换算（绕开全局展示币种，演示四种币种对照）。
function toDisplayFor(amountCny: number, code: CurrencyCode): number {
  const rate = FX_RATES[code] ?? 1
  return (amountCny ?? 0) / rate
}

function onLangChange(l: string): void {
  setLocale(l as Locale)
}
function onCurrencyChange(c: string): void {
  setCurrency(c as CurrencyCode)
}
</script>

<style scoped>
.hint {
  margin-bottom: 16px;
  border-radius: var(--r-lg);
}
.cfg-card {
  border-radius: var(--r-lg);
  margin-bottom: 16px;
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-900);
}
.tip {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: var(--ink-400);
  line-height: 1.6;
}
.rate-table :deep(.el-tag) {
  font-weight: 600;
}
.mono {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-variant-numeric: tabular-nums;
}
.conv-input {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.conv-label {
  font-weight: 700;
  color: var(--ink-700);
  width: 44px;
  flex: none;
}
.full {
  width: 100%;
}
.conv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.conv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--line-soft);
  border-radius: var(--r-md);
}
.conv-code {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-600);
}
.conv-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--ink-900);
}
</style>
