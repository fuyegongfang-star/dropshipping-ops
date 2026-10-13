<template>
  <el-container class="layout">
    <!-- 侧边栏：深色渐变 + 图标菜单 + 可折叠 -->
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="logo" :class="{ folded: collapsed }">
        <span class="logo-ico"><AppIcon name="package" :size="20" /></span>
        <span v-show="!collapsed" class="logo-text">
          <strong>代发·货代</strong>
          <small>运营中台</small>
        </span>
      </div>

      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        router
        class="side-menu"
      >
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <AppIcon :name="m.icon" :size="19" />
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>

      <div v-show="!collapsed" class="aside-foot">
        <span class="dot" /> 服务运行中
      </div>
    </el-aside>

    <el-container>
      <!-- 顶栏：白底轻阴影 + 折叠按钮 + 面包屑 + 租户切换 + 头像 -->
      <el-header class="header">
        <div class="h-left">
          <button class="collapse-btn" title="折叠/展开" @click="collapsed = !collapsed">
            <AppIcon name="menu" :size="20" />
          </button>
          <div class="crumb">
            <AppIcon name="layers" :size="15" class="crumb-ico" />
            <span>{{ currentTitle }}</span>
          </div>
        </div>

        <div class="h-right">
          <span class="demo-badge"><AppIcon name="check" :size="13" /> 演示模式</span>

          <el-select
            class="tenant-select"
            :model-value="tenantStore.currentTenantCode"
            placeholder="选择租户"
            @change="onTenantChange"
          >
            <el-option
              v-for="t in tenantStore.tenants"
              :key="t.code"
              :label="t.name"
              :value="t.code"
            />
          </el-select>

          <button class="icon-btn" title="通知">
            <AppIcon name="bell" :size="18" />
            <span class="badge-dot" />
          </button>

          <span class="avatar"><AppIcon name="user" :size="18" /></span>
        </div>
      </el-header>

      <!-- 主内容区 -->
      <el-main class="main">
        <div class="content">
          <router-view v-slot="{ Component }">
            <transition name="fade-slide" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import http from '@/api/http'
import AppIcon from '@/components/AppIcon.vue'

// 基础布局：深色渐变侧边栏 + 顶栏 + 主内容区（方案 §0/§17 多租户透传）。
const tenantStore = useTenantStore()
const route = useRoute()
const collapsed = ref(false)

const menus = [
  { path: '/', title: '仪表盘', icon: 'dashboard' },
  { path: '/orders', title: '订单中心', icon: 'orders' },
  { path: '/catalog', title: '商品 / SKU', icon: 'catalog' },
  { path: '/channels', title: '渠道 / 店铺', icon: 'channels' },
  { path: '/carriers', title: '承运商管理', icon: 'truck' },
  { path: '/quotes', title: '运费试算', icon: 'calculator' },
  { path: '/pricing', title: '加价 / 币种', icon: 'sliders' },
  { path: '/tenants', title: '租户管理', icon: 'tenants' },
]

const currentTitle = computed(
  () => menus.find((m) => m.path === route.path)?.title ?? '仪表盘',
)

onMounted(async () => {
  tenantStore.loadFromStorage()
  try {
    const list = await http.get<{ code: string; name: string }[]>('/tenants')
    tenantStore.tenants = list ?? []
    // 未选租户时默认选中第一个（演示用），确保数据可见
    if (!tenantStore.currentTenantCode && tenantStore.tenants.length) {
      tenantStore.setTenant(tenantStore.tenants[0].code)
    }
  } catch {
    tenantStore.tenants = []
  }
})

function onTenantChange(code: string): void {
  tenantStore.setTenant(code)
}
</script>

<style scoped>
.layout {
  height: 100vh;
}

/* ---------- 侧边栏 ---------- */
.aside {
  background: linear-gradient(180deg, #1b2746 0%, #0f172a 100%);
  display: flex;
  flex-direction: column;
  transition: width 0.22s var(--ease);
  overflow: hidden;
}
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 18px;
  color: #fff;
}
.logo.folded {
  justify-content: center;
  padding: 0;
}
.logo-ico {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: var(--sh-brand);
  flex: none;
}
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  white-space: nowrap;
}
.logo-text strong {
  font-size: 16px;
  font-weight: 700;
}
.logo-text small {
  font-size: 11px;
  color: var(--ink-400);
  letter-spacing: 1px;
}

.side-menu {
  flex: 1;
  background: transparent !important;
  border-right: none;
  padding: 8px 0;
}
.side-menu :deep(.el-menu-item) {
  color: #c3cce0;
  height: 46px;
  margin: 4px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.18s var(--ease);
}
.side-menu :deep(.el-menu-item .el-icon),
.side-menu :deep(.el-menu-item svg) {
  margin-right: 10px;
}
.side-menu :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}
.side-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(79, 110, 247, 0.26), rgba(79, 110, 247, 0.08));
  color: #fff;
  position: relative;
}
.side-menu :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: 3px;
  background: var(--brand-400);
}
.aside-foot {
  padding: 14px 20px;
  font-size: 12px;
  color: var(--ink-400);
  display: flex;
  align-items: center;
  gap: 8px;
}
.aside-foot .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.2);
}

/* ---------- 顶栏 ---------- */
.header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 1px 3px rgba(16, 24, 40, 0.04);
  padding: 0 20px;
}
.h-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.collapse-btn {
  width: 38px;
  height: 38px;
  border: none;
  background: var(--line-soft);
  color: var(--ink-600);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s var(--ease);
}
.collapse-btn:hover {
  background: var(--brand-soft);
  color: var(--brand-600);
}
.crumb {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-800);
}
.crumb-ico {
  color: var(--brand-500);
}
.h-right {
  display: flex;
  align-items: center;
  gap: 14px;
}
.demo-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 11px;
  border-radius: var(--r-pill);
  background: var(--brand-soft);
  color: var(--brand-700);
  font-size: 12px;
  font-weight: 600;
}
.tenant-select {
  width: 150px;
}
.icon-btn {
  position: relative;
  width: 38px;
  height: 38px;
  border: none;
  background: var(--line-soft);
  color: var(--ink-600);
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s var(--ease);
}
.icon-btn:hover {
  background: var(--brand-soft);
  color: var(--brand-600);
}
.badge-dot {
  position: absolute;
  top: 9px;
  right: 10px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--orange-500);
  border: 2px solid var(--surface);
}
.avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-500), var(--violet-500));
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--sh-2);
}

/* ---------- 主内容 ---------- */
.main {
  background: var(--bg);
  padding: 0;
}
.content {
  padding: 24px;
  min-height: calc(100vh - 60px);
}
</style>
