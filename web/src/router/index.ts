import { createRouter, createWebHistory } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import DashboardView from '@/views/DashboardView.vue'
import OrdersView from '@/views/OrdersView.vue'
import CatalogView from '@/views/CatalogView.vue'
import ChannelsView from '@/views/ChannelsView.vue'
import TenantsView from '@/views/TenantsView.vue'

// 前端路由（方案 §11）：基础布局 + 业务模块页面（订单/商品SKU/渠道/租户）。
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
        { path: 'tenants', name: 'tenants', component: TenantsView, meta: { title: '租户' } },
      ],
    },
  ],
})

export default router
