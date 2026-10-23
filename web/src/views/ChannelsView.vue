<template>
  <div class="channels">
    <PageHeader
      title="渠道 / 店铺中心"
      subtitle="多渠道店铺接入 · 按店铺调用适配器拉单落库"
      icon="channels"
      accent="teal"
    >
      <template #actions>
        <el-button @click="load">
          <AppIcon name="refresh" :size="15" class="btn-ico" />刷新
        </el-button>
      </template>
    </PageHeader>

    <div class="tip">
      <AppIcon name="warning" :size="16" class="tip-ico" />
      <div class="tip-body">
        <strong>演示说明</strong>
        <p>
          「拉单」按店铺调用对应渠道适配器并落库为 pending_review 订单。
          <b>Mock 演示店</b>无需凭证即可生成订单；Shopify / Amazon 需配置真实平台凭证，
          否则会返回错误（可借此观察异常处理）。
        </p>
      </div>
    </div>

    <el-card>
      <template #header>
        <div class="card-head">
          <span class="section-title">已接入店铺</span>
          <span class="count-pill">共 {{ shops.length }} 家</span>
        </div>
      </template>

      <el-table v-loading="loading" :data="shops">
        <el-table-column label="店铺" min-width="210">
          <template #default="{ row }">
            <span class="cell-shop">
              <span class="shop-badge"><AppIcon name="shop" :size="15" /></span>
              <span class="shop-name">{{ row.name }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="平台" width="135">
          <template #default="{ row }">
            <span class="tag-soft" :class="platformClass(row.platform)">{{ row.platform }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="175">
          <template #default="{ row }"><span class="muted">{{ fmt(row.createdAt) }}</span></template>
        </el-table-column>
        <el-table-column label="操作" width="130">
          <template #default="{ row }">
            <el-button size="small" type="primary" :loading="pulling === row.id" @click="pull(row)">
              <AppIcon name="refresh" :size="14" class="btn-ico" />拉单
            </el-button>
          </template>
        </el-table-column>

        <template #empty>
          <div class="app-empty">
            <span class="app-empty-ico"><AppIcon name="shop" :size="26" /></span>
            <span class="app-empty-text">暂无店铺</span>
          </div>
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { channelsApi, type Shop } from '@/api/channels'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

const shops = ref<Shop[]>([])
const loading = ref(false)
const pulling = ref('')

function fmt(ts: string): string {
  return ts ? new Date(ts).toLocaleString('zh-CN', { hour12: false }) : '-'
}

/** 平台 → 标签配色 */
function platformClass(platform: string): string {
  const p = (platform || '').toLowerCase()
  if (p.includes('shopify')) return 'tag-green'
  if (p.includes('amazon')) return 'tag-orange'
  if (p.includes('taobao')) return 'tag-pink'
  if (p.includes('douyin')) return 'tag-cyan'
  if (p.includes('mock')) return 'tag-violet'
  return 'tag-gray'
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
.btn-ico {
  margin-right: 5px;
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
  color: #0f766e;
  background: var(--teal-soft);
  padding: 4px 10px;
  border-radius: var(--r-pill);
}
.tip {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 16px;
  margin-bottom: 16px;
  border-radius: var(--r-md);
  background: linear-gradient(90deg, var(--brand-soft), #f7fbff);
  border: 1px solid #e3ecff;
}
.tip-ico {
  color: var(--brand-600);
  margin-top: 2px;
}
.tip-body {
  font-size: 13px;
  color: var(--ink-700);
  line-height: 1.7;
}
.tip-body strong {
  display: block;
  color: var(--ink-900);
  margin-bottom: 3px;
}
.tip-body p {
  margin: 0;
}
.tip-body b {
  color: var(--brand-700);
}
.cell-shop {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}
.shop-badge {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: var(--line-soft);
  color: var(--ink-600);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.shop-name {
  font-weight: 500;
  color: var(--ink-800);
}
.muted {
  color: var(--ink-500);
}
.tag-soft {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}
.tag-green {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.12);
}
.tag-orange {
  color: #ea580c;
  background: rgba(234, 88, 12, 0.12);
}
.tag-pink {
  color: #db2777;
  background: rgba(219, 39, 119, 0.12);
}
.tag-cyan {
  color: #0891b2;
  background: rgba(8, 145, 178, 0.12);
}
.tag-violet {
  color: #7c3aed;
  background: rgba(124, 58, 237, 0.12);
}
.tag-gray {
  color: #64748b;
  background: rgba(100, 116, 139, 0.12);
}
</style>
