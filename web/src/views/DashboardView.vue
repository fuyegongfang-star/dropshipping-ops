<template>
  <div class="dashboard">
    <el-alert
      v-if="!tenantStore.currentTenantCode"
      type="warning"
      :closable="false"
      title="未选择租户"
      description="请在右上角选择租户（默认已选中 demo），所有数据按租户隔离展示。"
      style="margin-bottom: 16px"
    />

    <el-row :gutter="16">
      <el-col v-for="c in cards" :key="c.label" :span="6">
        <el-card shadow="hover" class="stat">
          <div class="stat-num">{{ c.value }}</div>
          <div class="stat-label">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="14">
        <el-card>
          <template #header>订单状态分布</template>
          <el-table :data="statusRows" stripe>
            <el-table-column label="状态">
              <template #default="{ row }">{{ statusLabels[row.status] || row.status }}</template>
            </el-table-column>
            <el-table-column prop="count" label="数量" width="100" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card>
          <template #header>运营概览</template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="当前租户">
              {{ tenantStore.currentTenantCode || '未选择' }}
            </el-descriptions-item>
            <el-descriptions-item label="系统状态">业务模块已打通，可交互演示</el-descriptions-item>
            <el-descriptions-item label="建议体验">
              订单中心 → 审单 / 状态转移 / 逆向；渠道中心 → Mock 店拉单
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useTenantStore } from '@/stores/tenant'
import { tenantsApi } from '@/api/tenants'
import { channelsApi } from '@/api/channels'
import { catalogApi } from '@/api/catalog'
import { ordersApi, ORDER_STATUS_LABELS, type Order } from '@/api/orders'

const tenantStore = useTenantStore()
const statusLabels = ORDER_STATUS_LABELS

const counts = ref({ tenants: 0, shops: 0, skus: 0, orders: 0 })
const orders = ref<Order[]>([])

const cards = computed(() => [
  { label: '租户', value: counts.value.tenants },
  { label: '店铺/渠道', value: counts.value.shops },
  { label: '内部 SKU', value: counts.value.skus },
  { label: '订单', value: counts.value.orders },
])

const statusRows = computed(() => {
  const map: Record<string, number> = {}
  for (const o of orders.value) map[o.status] = (map[o.status] || 0) + 1
  return Object.entries(map).map(([status, count]) => ({ status, count }))
})

async function load(): Promise<void> {
  try {
    const [tenants, shops, skus, ord] = await Promise.all([
      tenantsApi.list(),
      channelsApi.shops(),
      catalogApi.skus(),
      ordersApi.list(),
    ])
    counts.value = {
      tenants: tenants.length,
      shops: shops.length,
      skus: skus.length,
      orders: ord.length,
    }
    orders.value = ord
  } catch (e) {
    ElMessage.error('看板加载失败：' + (e as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
.stat-num {
  font-size: 28px;
  font-weight: 600;
}
.stat-label {
  color: #909399;
  margin-top: 4px;
}
</style>
