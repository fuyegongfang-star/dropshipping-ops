import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import BasicLayout from '@/layouts/BasicLayout.vue'
import DashboardView from '@/views/DashboardView.vue'
import OrdersView from '@/views/OrdersView.vue'
import CatalogView from '@/views/CatalogView.vue'
import ChannelsView from '@/views/ChannelsView.vue'
import CarriersView from '@/views/CarriersView.vue'
import QuotesView from '@/views/QuotesView.vue'
import PricingRulesView from '@/views/PricingRulesView.vue'
import ProgressView from '@/views/ProgressView.vue'
import TenantsView from '@/views/TenantsView.vue'

// 前端路由（方案 §11）：基础布局 + 业务模块页面（订单/商品SKU/渠道/承运商/定价/开发进度/租户）。
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
        { path: 'carriers', name: 'carriers', component: CarriersView, meta: { title: '承运商管理' } },
        { path: 'quotes', name: 'quotes', component: QuotesView, meta: { title: '运费试算' } },
        { path: 'pricing', name: 'pricing', component: PricingRulesView, meta: { title: '加价 / 币种' } },
        // 内部视图：仅平台运营方（super）可见
        { path: 'progress', name: 'progress', component: ProgressView, meta: { title: '开发进度', roles: ['super'] } },
        { path: 'tenants', name: 'tenants', component: TenantsView, meta: { title: '租户', roles: ['super'] } },
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
