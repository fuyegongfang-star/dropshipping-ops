import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import BasicLayout from '@/layouts/BasicLayout.vue'
import DashboardView from '@/views/DashboardView.vue'
import OrdersView from '@/views/OrdersView.vue'
import CatalogView from '@/views/CatalogView.vue'
import ChannelsView from '@/views/ChannelsView.vue'
import AmazonView from '@/views/AmazonView.vue'
import CarriersView from '@/views/CarriersView.vue'
import QuotesView from '@/views/QuotesView.vue'
import ShipmentsView from '@/views/ShipmentsView.vue'
import AddressView from '@/views/AddressView.vue'
import AggregatorView from '@/views/AggregatorView.vue'
import WalletView from '@/views/WalletView.vue'
import BillingView from '@/views/BillingView.vue'
import ProfitView from '@/views/ProfitView.vue'
import ClaimsView from '@/views/ClaimsView.vue'
import RiskView from '@/views/RiskView.vue'
import ReportsView from '@/views/ReportsView.vue'
import SecurityView from '@/views/SecurityView.vue'
import CapacityView from '@/views/CapacityView.vue'
import FulfillmentView from '@/views/FulfillmentView.vue'
import RbacView from '@/views/RbacView.vue'
import OpenPlatformView from '@/views/OpenPlatformView.vue'
import LocalizationView from '@/views/LocalizationView.vue'
import PricingRulesView from '@/views/PricingRulesView.vue'
import SiteSettingsView from '@/views/SiteSettingsView.vue'
import ProgressView from '@/views/ProgressView.vue'
import TenantsView from '@/views/TenantsView.vue'

// 前端路由（方案 §11）：基础布局 + 业务模块页面（订单/商品SKU/渠道/承运商/定价/开发进度/租户）。
// 菜单按「业务运营 / 物流履约 / 财务中心 / 系统设置」分组（见 BasicLayout.vue 的 menuNodes），
// meta.roles 标注「仅平台运营方可见」的内部视图，由下方路由守卫拦截。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: BasicLayout,
      children: [
        { path: '', name: 'dashboard', component: DashboardView, meta: { title: '仪表盘' } },
        { path: 'orders', name: 'orders', component: OrdersView, meta: { title: '订单中心' } },
        { path: 'catalog', name: 'catalog', component: CatalogView, meta: { title: '商品/SKU' } },
        { path: 'channels', name: 'channels', component: ChannelsView, meta: { title: '渠道' } },
        { path: 'amazon', name: 'amazon', component: AmazonView, meta: { title: 'Amazon 对接' } },
        { path: 'reports', name: 'reports', component: ReportsView, meta: { title: '运营报表' } },
        { path: 'carriers', name: 'carriers', component: CarriersView, meta: { title: '承运商管理' } },
        { path: 'quotes', name: 'quotes', component: QuotesView, meta: { title: '运费试算' } },
        { path: 'fulfillment', name: 'fulfillment', component: FulfillmentView, meta: { title: '履约路由' } },
        { path: 'shipments', name: 'shipments', component: ShipmentsView, meta: { title: '两段式运单' } },
        { path: 'address', name: 'address', component: AddressView, meta: { title: '地址校验' } },
        { path: 'aggregator', name: 'aggregator', component: AggregatorView, meta: { title: '聚合追踪' } },
        { path: 'wallet', name: 'wallet', component: WalletView, meta: { title: '收款账务' } },
        { path: 'billing', name: 'billing', component: BillingView, meta: { title: '商户账单' } },
        { path: 'profit', name: 'profit', component: ProfitView, meta: { title: '利润核算' } },
        { path: 'claims', name: 'claims', component: ClaimsView, meta: { title: '理赔保险' } },
        { path: 'risk', name: 'risk', component: RiskView, meta: { title: '风控中心' } },
        { path: 'pricing', name: 'pricing', component: PricingRulesView, meta: { title: '运营配置' } },
        // 内部视图：仅平台运营方（super）可见
        {
          path: 'settings/site',
          name: 'siteSettings',
          component: SiteSettingsView,
          meta: { title: '站点设置', roles: ['super'] },
        },
        { path: 'progress', name: 'progress', component: ProgressView, meta: { title: '开发进度', roles: ['super'] } },
        { path: 'tenants', name: 'tenants', component: TenantsView, meta: { title: '租户', roles: ['super'] } },
        { path: 'security', name: 'security', component: SecurityView, meta: { title: '安全加固', roles: ['super'] } },
        { path: 'capacity', name: 'capacity', component: CapacityView, meta: { title: '容量与灾备', roles: ['super'] } },
        { path: 'rbac', name: 'rbac', component: RbacView, meta: { title: '权限管理', roles: ['super'] } },
        { path: 'open-platform', name: 'openPlatform', component: OpenPlatformView, meta: { title: '开放平台', roles: ['super'] } },
        { path: 'localization', name: 'localization', component: LocalizationView, meta: { title: '本地化设置' } },
      ],
    },
  ],
})

// 角色守卫：标记了 meta.roles 的路由，非对应角色访问时重定向首页（卖家租户看不到内部视图）。
router.beforeEach((to) => {
  const roles = to.meta.roles as string[] | undefined
  if (roles && roles.length) {
    const userStore = useUserStore()
    if (!roles.includes(userStore.role)) {
      return { path: '/' }
    }
  }
  return true
})

export default router
