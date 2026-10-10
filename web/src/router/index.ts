import { createRouter, createWebHistory } from 'vue-router'
import BasicLayout from '@/layouts/BasicLayout.vue'
import DashboardView from '@/views/DashboardView.vue'

// 前端路由（方案 §11）：基础布局 + 仪表盘示例，后续按业务模块（订单/物流/结算…）扩展。
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: BasicLayout,
      children: [{ path: '', name: 'dashboard', component: DashboardView }],
    },
  ],
})

export default router
