<template>
  <el-container class="layout">
    <el-aside width="220px" class="aside">
      <div class="logo">代发·货代运营</div>
      <el-menu :default-active="route.path" router>
        <el-menu-item index="/">仪表盘</el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span>一件代发货代运营平台</span>
        <el-select
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
      </el-header>
      <el-main>
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantStore } from '@/stores/tenant'
import http from '@/api/http'

// 基础布局：侧边菜单 + 顶栏租户切换器（方案 §0/§17：前端租户选择透传 x-tenant-id）。
const tenantStore = useTenantStore()
const route = useRoute()

onMounted(async () => {
  tenantStore.loadFromStorage()
  try {
    // 拉取租户列表（演示用，生产需超管鉴权，§22）
    const list = await http.get('/tenants')
    tenantStore.tenants = list ?? []
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
.logo {
  padding: 16px;
  font-weight: 600;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eee;
}
</style>
