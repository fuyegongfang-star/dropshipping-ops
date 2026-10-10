<template>
  <div class="dashboard">
    <el-card>
      <template #header>运营概览</template>
      <p>当前租户：{{ tenantStore.currentTenantCode || '未选择' }}</p>
      <p>系统状态：脚手架就绪，业务模块开发中。</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useTenantStore } from '@/stores/tenant'

// 仪表盘（示例页；运营报表看板于阶段4 按 §25 指标口径扩展）。
const tenantStore = useTenantStore()
</script>
