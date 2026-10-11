<template>
  <div class="channels">
    <el-card>
      <template #header>
        <div class="head">
          <span>渠道 / 店铺中心</span>
          <el-button @click="load">刷新</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        title="演示说明"
        description="「拉单」按店铺调用对应渠道适配器并落库为 pending_review 订单。Mock 演示店无需凭证即可生成订单；Shopify / Amazon 需配置真实平台凭证，否则会返回错误（可借此观察异常处理）。"
        style="margin-bottom: 12px"
      />

      <el-table v-loading="loading" :data="shops" stripe>
        <el-table-column prop="name" label="店铺" min-width="200" />
        <el-table-column label="平台" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.platform }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ fmt(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              :loading="pulling === row.id"
              @click="pull(row)"
            >
              拉单
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { channelsApi, type Shop } from '@/api/channels'

const shops = ref<Shop[]>([])
const loading = ref(false)
const pulling = ref('')

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    shops.value = await channelsApi.shops()
  } catch (e) {
    ElMessage.error('加载店铺失败：' + (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function pull(row: Shop): Promise<void> {
  pulling.value = row.id
  try {
    const res = await channelsApi.pull(row.id)
    if (res.failed > 0) {
      ElMessage.warning(`拉单完成：新建 ${res.created}，失败 ${res.failed}`)
    } else {
      ElMessage.success(`拉单成功：新建 ${res.created} 单（已落库为待审）`)
    }
  } catch (e) {
    ElMessage.error(`拉单失败（${row.platform} 需配置凭证）：${(e as Error).message}`)
  } finally {
    pulling.value = ''
  }
}

onMounted(load)
</script>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
