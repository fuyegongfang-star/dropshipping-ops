<template>
  <div class="catalog">
    <PageHeader
      title="商品 / SKU 中心"
      subtitle="平台 ↔ 内部 ↔ 供应商 三段映射 · 计费重自动派生"
      icon="catalog"
      accent="violet"
    >
      <template #actions>
        <el-button @click="reload">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
      </template>
    </PageHeader>

    <el-card>
      <el-tabs v-model="tab" class="tabs">
        <el-tab-pane name="products">
          <template #label>
            <span class="tab-label">
              <AppIcon name="layers" :size="15" />商品（SPU）
              <em>{{ products.length }}</em>
            </span>
          </template>
          <el-table v-loading="loadingP" :data="products">
            <el-table-column prop="title" label="标题" min-width="200">
              <template #default="{ row }"><span class="t-title">{{ row.title }}</span></template>
            </el-table-column>
            <el-table-column prop="spu" label="SPU" width="150">
              <template #default="{ row }"><span class="mono">{{ row.spu }}</span></template>
            </el-table-column>
            <el-table-column label="创建时间" min-width="175">
              <template #default="{ row }"><span class="muted">{{ fmt(row.createdAt) }}</span></template>
            </el-table-column>
            <template #empty>
              <div class="app-empty">
                <span class="app-empty-ico"><AppIcon name="layers" :size="26" /></span>
                <span class="app-empty-text">暂无商品数据</span>
              </div>
            </template>
          </el-table>
        </el-tab-pane>

        <el-tab-pane name="skus">
          <template #label>
            <span class="tab-label">
              <AppIcon name="box" :size="15" />内部 SKU
              <em>{{ skus.length }}</em>
            </span>
          </template>
          <el-table v-loading="loadingS" :data="skus">
            <el-table-column prop="code" label="内部SKU" width="145">
              <template #default="{ row }"><span class="mono">{{ row.code }}</span></template>
            </el-table-column>
            <el-table-column prop="platformSku" label="平台SKU" width="165">
              <template #default="{ row }"><span class="muted">{{ row.platformSku }}</span></template>
            </el-table-column>
            <el-table-column prop="supplierSku" label="供应商SKU" width="165">
              <template #default="{ row }"><span class="muted">{{ row.supplierSku }}</span></template>
            </el-table-column>
            <el-table-column label="实重(g)" width="95" prop="weightG" />
            <el-table-column label="体积重(g)" width="105">
              <template #default="{ row }"><span class="muted">{{ volWeight(row) }}</span></template>
            </el-table-column>
            <el-table-column label="计费重(g)" width="110">
              <template #default="{ row }">
                <span class="weight-pill">{{ billable(row) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="尺寸(cm)" min-width="145">
              <template #default="{ row }">
                <span class="muted">{{ dims(row) }}</span>
              </template>
            </el-table-column>
            <template #empty>
              <div class="app-empty">
                <span class="app-empty-ico"><AppIcon name="box" :size="26" /></span>
                <span class="app-empty-text">暂无 SKU 数据</span>
              </div>
            </template>
          </el-table>

          <div class="formula">
            <AppIcon name="warning" :size="15" class="f-ico" />
            <span>
              计费重 = max(实重, 体积重)，体积重 = 长×宽×高 / 抛比系数(5000)。
              拉单落库时按平台 SKU 自动回填内部 skuId（见订单明细）。
            </span>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { catalogApi, type Product, type Sku } from '@/api/catalog'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

const tab = ref('products')
const products = ref<Product[]>([])
const skus = ref<Sku[]>([])
const loadingP = ref(false)
const loadingS = ref(false)

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function dims(row: Sku): string {
  return [row.lengthCm, row.widthCm, row.heightCm].filter((v) => v != null).join(' × ') || '-'
}

function volWeight(row: Sku): number | string {
  if (row.lengthCm == null || row.widthCm == null || row.heightCm == null) return '-'
  return Math.round(((row.lengthCm * row.widthCm * row.heightCm) / 5000) * 1000)
}

function billable(row: Sku): number {
  const v = volWeight(row)
  return Math.max(row.weightG, typeof v === 'number' ? v : 0)
}

async function loadProducts(): Promise<void> {
  loadingP.value = true
  try {
    products.value = await catalogApi.products()
  } finally {
    loadingP.value = false
  }
}

async function loadSkus(): Promise<void> {
  loadingS.value = true
  try {
    skus.value = await catalogApi.skus()
  } finally {
    loadingS.value = false
  }
}

function reload(): void {
  loadProducts()
  loadSkus()
}

onMounted(reload)
</script>

<style scoped>
.btn-ico {
  margin-right: 5px;
}
.tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tab-label em {
  font-style: normal;
  background: var(--violet-soft);
  color: #6d28d9;
  border-radius: var(--r-pill);
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
}
.t-title {
  font-weight: 500;
  color: var(--ink-800);
}
.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 12.5px;
}
.muted {
  color: var(--ink-500);
}
.weight-pill {
  display: inline-block;
  min-width: 52px;
  text-align: center;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: var(--violet-soft);
  color: #6d28d9;
  font-weight: 700;
  font-size: 12.5px;
}
.formula {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 12px 14px;
  background: var(--line-soft);
  border-radius: var(--r-md);
  color: var(--ink-500);
  font-size: 12.5px;
  line-height: 1.7;
}
.f-ico {
  color: var(--amber-500);
  margin-top: 2px;
}
</style>
