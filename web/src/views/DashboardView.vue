<template>
  <div v-loading="loading" class="dashboard">
    <el-alert
      v-if="!tenantStore.currentTenantCode"
      type="warning"
      :closable="false"
      title="未选择租户"
      description="请在右上角选择租户（默认已选中 demo），所有数据按租户隔离展示。"
      class="dash-alert"
    />

    <PageHeader
      title="运营仪表盘"
      subtitle="实时掌握代发 / 货代核心指标"
      icon="dashboard"
      accent="brand"
    >
      <template #actions>
        <span class="scope-pill">
          <AppIcon name="building" :size="13" />
          {{ tenantStore.currentTenantCode || '未选择租户' }}
        </span>
      </template>
    </PageHeader>

    <!-- 统计卡片区：渐变图标徽章 + 大数字 -->
    <el-row :gutter="16">
      <el-col v-for="c in cards" :key="c.label" :span="6">
        <div class="stat-card">
          <span class="stat-deco" :style="{ background: c.deco }" />
          <span class="stat-ico" :class="c.bg"><AppIcon :name="c.icon" :size="22" /></span>
          <div class="stat-num">{{ c.value }}</div>
          <div class="stat-label">{{ c.label }}</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="row-second">
      <el-col :span="14">
        <el-card>
          <template #header><span class="section-title">订单状态分布</span></template>
          <div v-if="statusRows.length" class="dist">
            <div v-for="r in statusRows" :key="r.status" class="dist-row">
              <div class="dist-top">
                <span class="dist-name">
                  <i class="dist-dot" :class="dotOf(r.status)" />
                  {{ statusLabels[r.status] || r.status }}
                </span>
                <span class="dist-count">{{ r.count }}</span>
              </div>
              <div class="dist-bar">
                <span class="bar-fill" :class="dotOf(r.status)" :style="{ width: pct(r.count) }" />
              </div>
            </div>
          </div>
          <div v-else class="app-empty">
            <span class="app-empty-ico"><AppIcon name="orders" :size="26" /></span>
            <span class="app-empty-text">暂无订单数据</span>
          </div>
        </el-card>
      </el-col>

      <el-col :span="10">
        <el-card>
          <template #header><span class="section-title">运营概览</span></template>
          <div class="overview">
            <div class="ov-row">
              <span class="ov-k">当前租户</span>
              <span class="ov-v strong">{{ tenantStore.currentTenantCode || '未选择' }}</span>
            </div>
            <div class="ov-row">
              <span class="ov-k">系统状态</span>
              <span class="ov-v"><span class="tag-soft tag-green">正常运行</span></span>
            </div>
            <div class="ov-row">
              <span class="ov-k">建议体验</span>
              <span class="ov-v">
                <span class="tag-soft tag-brand">订单中心</span>
                审单 / 状态转移 / 逆向；
                <span class="tag-soft tag-teal">渠道中心</span>
                Mock 店拉单
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useTenantStore } from '@/stores/tenant'
import { tenantsApi } from '@/api/tenants'
import { channelsApi } from '@/api/channels'
import { catalogApi } from '@/api/catalog'
import { ordersApi, ORDER_STATUS_LABELS, type Order } from '@/api/orders'
import PageHeader from '@/components/PageHeader.vue'
import AppIcon from '@/components/AppIcon.vue'

const tenantStore = useTenantStore()
const statusLabels = ORDER_STATUS_LABELS

const loading = ref(false)
const counts = ref({ tenants: 0, shops: 0, skus: 0, orders: 0 })
const orders = ref<Order[]>([])

/** 四张统计卡：图标 + 渐变底色 + 装饰圆色 */
const cardConf = [
  { label: '租户', icon: 'tenants', bg: 'bg-brand', deco: 'var(--brand-500)' },
  { label: '店铺 / 渠道', icon: 'shop', bg: 'bg-teal', deco: 'var(--teal-500)' },
  { label: '内部 SKU', icon: 'catalog', bg: 'bg-violet', deco: 'var(--violet-500)' },
  { label: '订单', icon: 'orders', bg: 'bg-orange', deco: 'var(--orange-500)' },
]

const cards = computed(() =>
  cardConf.map((c, i) => ({
    ...c,
    value: [counts.value.tenants, counts.value.shops, counts.value.skus, counts.value.orders][i],
  })),
)

const statusRows = computed(() => {
  const map: Record<string, number> = {}
  for (const o of orders.value) map[o.status] = (map[o.status] || 0) + 1
  return Object.entries(map).map(([status, count]) => ({ status, count }))
})

/** 状态 → 配色类（圆点与进度条共用） */
function dotOf(status: string): string {
  if (status === 'completed') return 'c-green'
  if (status === 'exception') return 'c-orange'
  if (status === 'rejected') return 'c-red'
  if (status === 'cancelled') return 'c-gray'
  if (status === 'approved') return 'c-brand'
  if (['fulfilled', 'shipped', 'in_transit'].includes(status)) return 'c-teal'
  return 'c-amber'
}

/** 占比：以最大值为基准，保证小数据集也有可见长度 */
function pct(count: number): string {
  const max = Math.max(...statusRows.value.map((r) => r.count), 1)
  return Math.max((count / max) * 100, 4) + '%'
}

async function load(): Promise<void> {
  loading.value = true
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
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dash-alert {
  margin-bottom: 16px;
}
.scope-pill {
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
.row-second {
  margin-top: 16px;
}

/* 统计卡图标渐变底 */
.bg-brand {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}
.bg-teal {
  background: linear-gradient(135deg, #14c9b6, #0f8f82);
}
.bg-violet {
  background: linear-gradient(135deg, #9a7bff, #6d28d9);
}
.bg-orange {
  background: linear-gradient(135deg, #ffa257, #f97316);
}

/* 状态分布 */
.dist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.dist-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.dist-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink-700);
  font-weight: 500;
}
.dist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.dist-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-900);
}
.dist-bar {
  height: 7px;
  background: var(--line-soft);
  border-radius: var(--r-pill);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-pill);
  transition: width 0.4s var(--ease);
}
.c-green {
  background: var(--green-500);
}
.c-orange {
  background: var(--orange-500);
}
.c-red {
  background: var(--red-500);
}
.c-gray {
  background: var(--ink-400);
}
.c-brand {
  background: var(--brand-500);
}
.c-teal {
  background: var(--teal-500);
}
.c-amber {
  background: var(--amber-500);
}

/* 概览列表 */
.overview {
  display: flex;
  flex-direction: column;
}
.ov-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--line);
}
.ov-row:last-child {
  border-bottom: none;
}
.ov-k {
  color: var(--ink-500);
  font-size: 13px;
  flex: none;
}
.ov-v {
  font-size: 13px;
  color: var(--ink-700);
  text-align: right;
  line-height: 1.7;
}
.ov-v.strong {
  font-weight: 700;
  color: var(--ink-900);
}
</style>
