<template>
  <div class="catalog">
    <el-card>
      <template #header>商品 / SKU 中心（平台↔内部↔供应商映射）</template>
      <el-tabs v-model="tab">
        <el-tab-pane label="商品（SPU）" name="products">
          <el-table v-loading="loadingP" :data="products" stripe>
            <el-table-column prop="title" label="标题" min-width="180" />
            <el-table-column prop="spu" label="SPU" width="140" />
            <el-table-column label="创建时间" min-width="170">
              <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="内部 SKU" name="skus">
          <el-table v-loading="loadingS" :data="skus" stripe>
            <el-table-column prop="code" label="内部SKU" width="140" />
            <el-table-column prop="platformSku" label="平台SKU" width="160" />
            <el-table-column prop="supplierSku" label="供应商SKU" width="160" />
            <el-table-column label="实重(g)" width="90" prop="weightG" />
            <el-table-column label="体积重(g)" width="100">
              <template #default="{ row }">{{ volWeight(row) }}</template>
            </el-table-column>
            <el-table-column label="计费重(g)" width="100">
              <template #default="{ row }">
                <strong>{{ billable(row) }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="尺寸(cm)" min-width="140">
              <template #default="{ row }">
                {{ [row.lengthCm, row.widthCm, row.heightCm].filter((v) => v != null).join('×') || '-' }}
              </template>
            </el-table-column>
          </el-table>
          <p class="hint">
            计费重 = max(实重, 体积重)，体积重 = 长×宽×高 / 抛比系数(5000)。拉单落库时按平台 SKU 自动回填内部 skuId（见订单明细）。
          </p>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { catalogApi, type Product, type Sku } from '@/api/catalog'

const tab = ref('products')
const products = ref<Product[]>([])
const skus = ref<Sku[]>([])
const loadingP = ref(false)
const loadingS = ref(false)

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
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

onMounted(() => {
  loadProducts()
  loadSkus()
})
</script>

<style scoped>
.hint {
  color: #909399;
  font-size: 12px;
  margin-top: 12px;
}
</style>
