<template>
  <el-container class="layout">
    <!-- 侧边栏：深色渐变 + 图标菜单 + 可折叠 -->
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="logo" :class="{ folded: collapsed }">
        <!-- 站点 LOGO：取自「系统设置 → 站点设置」上传的品牌图，未上传则用内置图标 -->
        <span class="logo-ico" :class="{ 'has-img': !!siteStore.logoUrl }">
          <img v-if="siteStore.logoUrl" :src="siteStore.logoUrl" alt="站点 LOGO" />
          <AppIcon v-else name="package" :size="20" />
        </span>
        <!-- LOGO 文字取自「系统设置 → 站点设置」，保存后立即同步 -->
        <span v-show="!collapsed" class="logo-text">
          <strong :title="siteStore.siteName">{{ siteStore.siteName }}</strong>
          <small :title="siteStore.siteSlogan">{{ siteStore.siteSlogan }}</small>
        </span>
      </div>

      <el-menu
        :default-active="route.path"
        :collapse="collapsed"
        router
        class="side-menu"
      >
        <template v-for="node in visibleNodes" :key="'path' in node ? node.path : node.group">
          <el-menu-item v-if="'path' in node" :index="node.path">
            <AppIcon :name="node.icon" :size="19" />
            <span>{{ t(node.title) }}</span>
          </el-menu-item>
          <el-sub-menu v-else :index="node.group" popper-class="side-submenu-popup">
            <template #title>
              <AppIcon :name="node.groupIcon" :size="19" />
              <span>{{ t(node.group) }}</span>
            </template>
            <el-menu-item
              v-for="c in node.children"
              :key="c.path"
              :index="c.path"
            >
              <AppIcon :name="c.icon" :size="18" />
              <span>{{ t(c.title) }}</span>
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>

      <div v-show="!collapsed" class="aside-foot">
        <span class="dot" /> 服务运行中
      </div>
    </el-aside>

    <el-container>
      <!-- 顶栏：白底轻阴影 + 折叠按钮 + 面包屑 + 租户切换 + 身份切换 + 头像 -->
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
          <span class="demo-badge"><AppIcon name="check" :size="13" /> {{ t('app.demo') }}</span>

          <!-- 多语言 / 多币种切换（§27）：语言 + 展示币种，全局即时生效 -->
          <el-select
            :model-value="locale"
            class="locale-select"
            @change="onLocaleChange"
          >
            <el-option v-for="(label, code) in LOCALE_LABELS" :key="code" :label="label" :value="code" />
          </el-select>
          <el-select
            :model-value="displayCurrency"
            class="currency-select"
            @change="onCurrencyChange"
          >
            <el-option v-for="(label, code) in CURRENCY_LABELS" :key="code" :label="label" :value="code" />
          </el-select>

          <!-- 演示模式：身份切换，用于验证角色隔离（平台方 / 卖家视角） -->
          <el-select
            v-if="isDemo"
            class="role-select"
            :model-value="userStore.role"
            @change="onRoleChange"
          >
            <el-option
              v-for="(label, value) in userStore.ROLE_LABELS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>

          <el-select
            class="tenant-select"
            :model-value="tenantStore.currentTenantCode"
            placeholder="选择租户"
            @change="onTenantChange"
          >
            <el-option
              v-for="tn in tenantStore.tenants"
              :key="tn.code"
              :label="tn.name"
              :value="tn.code"
            />
          </el-select>

          <WhatsNew />

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
import { ref, computed, onMounted, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import { useSiteStore } from '@/stores/site'
import { useUserStore, type UserRole } from '@/stores/user'
import http from '@/api/http'
import AppIcon from '@/components/AppIcon.vue'
import WhatsNew from '@/components/WhatsNew.vue'
import {
  t,
  locale,
  displayCurrency,
  setLocale,
  setCurrency,
  LOCALE_LABELS,
  CURRENCY_LABELS,
  type Locale,
  type CurrencyCode,
} from '@/locales'

// 基础布局：深色渐变侧边栏 + 顶栏 + 主内容区（方案 §0/§17 多租户透传）。
const tenantStore = useTenantStore()
const siteStore = useSiteStore()
const userStore = useUserStore()
const route = useRoute()
const collapsed = ref(false)

// 浏览器标签页标题：页面名 + 站点名，随「站点设置」的站点名称实时变化。
watchEffect(() => {
  const pageTitle = (route.meta.title as string) || '仪表盘'
  document.title = `${pageTitle} - ${siteStore.siteName}`
})

// 浏览器标签图标（favicon）：随「站点设置 → Favicon」立即切换，未设置则移除动态 link 回落默认。
// 这样运营在设置页上传图标后，当前标签页图标当场就变，无需刷新即可确认效果。
watchEffect(() => {
  const href = siteStore.faviconUrl
  let link = document.querySelector<HTMLLinkElement>('link[data-app-favicon="true"]')
  if (!href) {
    link?.remove()
    return
  }
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    link.dataset.appFavicon = 'true'
    document.head.appendChild(link)
  }
  link.href = href
})

// 演示模式（VITE_USE_MOCK 未显式设为 false 即视为开）：显示身份切换，便于验证角色隔离。
const isDemo = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'

interface MenuEntry {
  path: string
  title: string
  icon: string
  roles?: string[]
}

// 菜单分组结构：顶层既可是独立项（如仪表盘），也可是分组（el-sub-menu）。
// 归类规则（交付隔离 + 使用直觉）：
//   - 业务运营：订单 / 商品 / 渠道 —— 天天要点的交易操作
//   - 物流履约：承运商 / 运费试算 —— 物流相关
//   - 财务中心：待阶段4 账务 / 对账 / 利润 / 理赔落地后入座
//   - 系统设置：平台配置类（运营配置 / 租户 / 权限 / i18n / 集成 / 开发进度），不天天点
type MenuNode =
  | MenuEntry
  | {
      group: string
      groupIcon: string
      children: MenuEntry[]
    }

const menuNodes: MenuNode[] = [
  { path: '/', title: 'menu.dashboard', icon: 'dashboard' },
  {
    group: 'group.business',
    groupIcon: 'grid',
    children: [
      { path: '/orders', title: 'menu.orders', icon: 'orders' },
      { path: '/catalog', title: 'menu.catalog', icon: 'catalog' },
      { path: '/channels', title: 'menu.channels', icon: 'channels' },
      { path: '/amazon', title: 'menu.amazon', icon: 'amazon' },
      { path: '/suppliers-dropship', title: 'menu.suppliersDropship', icon: 'supplier' },
      { path: '/warehouse', title: 'menu.warehouse', icon: 'warehouse' },
      { path: '/purchase-orders', title: 'menu.purchaseOrders', icon: 'purchase' },
      { path: '/reports', title: 'menu.reports', icon: 'chart' },
      { path: '/risk', title: 'menu.risk', icon: 'risk' },
    ],
  },
  {
    group: 'group.logistics',
    groupIcon: 'globe',
    children: [
      { path: '/carriers', title: 'menu.carriers', icon: 'truck' },
      { path: '/quotes', title: 'menu.quotes', icon: 'calculator' },
      { path: '/fulfillment', title: 'menu.fulfillment', icon: 'swap' },
      { path: '/shipments', title: 'menu.shipments', icon: 'layers' },
      { path: '/shipment-tracking', title: 'menu.shipmentTracking', icon: 'link' },
      { path: '/address', title: 'menu.address', icon: 'pin' },
      { path: '/aggregator', title: 'menu.aggregator', icon: 'radar' },
    ],
  },
  {
    group: 'group.finance',
    groupIcon: 'coins',
      children: [
      { path: '/wallet', title: 'menu.wallet', icon: 'wallet' },
      { path: '/billing', title: 'menu.billing', icon: 'bill' },
      { path: '/profit', title: 'menu.profit', icon: 'trend' },
      { path: '/claims', title: 'menu.claims', icon: 'claim' },
    ],
  },
  {
    group: 'group.system',
    groupIcon: 'settings',
    children: [
      { path: '/pricing', title: 'menu.pricing', icon: 'sliders' },
      { path: '/localization', title: 'menu.localization', icon: 'globe' },
      // 平台运营方专属：站点设置（站点名称/TDK）、租户管理、开发进度，卖家租户不可见
      { path: '/settings/site', title: 'menu.siteSettings', icon: 'flag', roles: ['super'] },
      { path: '/tenants', title: 'menu.tenants', icon: 'tenants', roles: ['super'] },
      { path: '/progress', title: 'menu.progress', icon: 'target', roles: ['super'] },
      { path: '/security', title: 'menu.security', icon: 'shield', roles: ['super'] },
      { path: '/capacity', title: 'menu.capacity', icon: 'bolt', roles: ['super'] },
      { path: '/rbac', title: 'menu.rbac', icon: 'key', roles: ['super'] },
      { path: '/open-platform', title: 'menu.openPlatform', icon: 'api', roles: ['super'] },
    ],
  },
]

// 按角色过滤：独立项按 roles 过滤；分组过滤子项，无可见子项则整组不显示（如空置的财务中心）。
const visibleNodes = computed<MenuNode[]>(() => {
  const role = userStore.role
  const pass = (m: MenuEntry) => !m.roles || m.roles.includes(role)
  return menuNodes
    .map((n) => {
      if ('path' in n) return pass(n) ? n : null
      const kids = n.children.filter(pass)
      return kids.length ? { ...n, children: kids } : null
    })
    .filter((x): x is MenuNode => x !== null)
})

// 展开所有可见菜单项（含分组子项），用于按路由反查标题。
const flatEntries = computed<MenuEntry[]>(() => {
  const list: MenuEntry[] = []
  for (const n of visibleNodes.value) {
    if ('path' in n) list.push(n)
    else list.push(...n.children)
  }
  return list
})

const currentTitle = computed(
  () => t(flatEntries.value.find((m) => m.path === route.path)?.title ?? 'menu.dashboard'),
)

onMounted(async () => {
  tenantStore.loadFromStorage()
  // 站点设置：站点名称 / Slogan 用于侧栏 LOGO 与标签页标题（加载失败时 store 回落默认值）
  await siteStore.load()
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

// 演示模式下的身份切换：模拟平台运营方 / 卖家租户，验证菜单与提醒的显隐。
function onRoleChange(r: string): void {
  userStore.setRole(r as UserRole)
}

// 多语言切换（§27）：即时切换导航与界面文案并持久化。
function onLocaleChange(l: string): void {
  setLocale(l as Locale)
}
// 展示币种切换（§27）：财务类金额按所选币种换算显示（记账仍基准币 CNY）。
function onCurrencyChange(c: string): void {
  setCurrency(c as CurrencyCode)
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
  overflow: hidden;
}
/* 已上传自定义 LOGO：去掉品牌渐变底，图片铺满圆角方框（与站点设置里的预览一致） */
.logo-ico.has-img {
  background: #fff;
}
.logo-ico img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
/* 站点名称可能较长（≤30 字），此处限宽并省略，避免撑破侧栏 */
.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
}
.logo-text strong,
.logo-text small {
  overflow: hidden;
  text-overflow: ellipsis;
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
.side-menu :deep(.el-menu-item),
.side-menu :deep(.el-sub-menu__title) {
  color: #c3cce0;
  height: 46px;
  margin: 4px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.18s var(--ease);
}
.side-menu :deep(.el-menu-item .el-icon),
.side-menu :deep(.el-menu-item svg),
.side-menu :deep(.el-sub-menu__title .el-icon),
.side-menu :deep(.el-sub-menu__title svg) {
  margin-right: 10px;
}
.side-menu :deep(.el-menu-item:hover),
.side-menu :deep(.el-sub-menu__title:hover) {
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

/* ---------- 内联子菜单（展开后的二级项）----------
   Element Plus 的 .el-menu--inline 默认自带浅色背景，会在深色侧栏里露出一块白底，
   这里统一清成透明并让子项配色、层级与一级项协调。 */
.side-menu :deep(.el-sub-menu) {
  margin-bottom: 2px;
}
.side-menu :deep(.el-menu--inline) {
  background: transparent !important;
}
.side-menu :deep(.el-menu--inline .el-menu-item) {
  height: 40px;
  margin: 2px 12px 2px 22px;
  padding-left: 14px !important;
  font-size: 13.5px;
  font-weight: 400;
  color: #9fabcb;
  background: transparent;
}
.side-menu :deep(.el-menu--inline .el-menu-item svg) {
  opacity: 0.85;
}
.side-menu :deep(.el-menu--inline .el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}
.side-menu :deep(.el-menu--inline .el-menu-item.is-active) {
  color: #fff;
  font-weight: 500;
  background: linear-gradient(90deg, rgba(79, 110, 247, 0.22), rgba(79, 110, 247, 0.06));
}
.side-menu :deep(.el-menu--inline .el-menu-item.is-active)::before {
  top: 8px;
  bottom: 8px;
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
/* 演示模式身份切换（验证角色隔离） */
.role-select {
  width: 130px;
}
/* 多语言 / 展示币种切换（§27） */
.locale-select {
  width: 96px;
}
.currency-select {
  width: 118px;
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

<!-- 折叠态：hover 分组时 Element 弹出的浮层菜单（挂在 body 下，scoped 样式够不到，
     故用 popper-class="side-submenu-popup" 单独限定作用域，避免污染全局弹层）。 -->
<style>
.side-submenu-popup .el-menu--popup {
  background: #16213c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 6px;
  min-width: 168px;
}
.side-submenu-popup .el-menu-item {
  height: 40px;
  margin: 2px 0;
  border-radius: 8px;
  color: #9fabcb;
  font-size: 13.5px;
}
.side-submenu-popup .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.side-submenu-popup .el-menu-item.is-active {
  background: rgba(79, 110, 247, 0.24);
  color: #fff;
}
</style>
