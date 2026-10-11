<template>
  <!-- 统一页面标题区：图标徽章 + 标题/副标题 + 右侧操作插槽。 -->
  <div class="page-header">
    <div class="ph-left">
      <span class="ph-ico" :class="`accent-${accent}`">
        <AppIcon :name="icon" :size="20" />
      </span>
      <div class="ph-text">
        <h2 class="ph-title">{{ title }}</h2>
        <p v-if="subtitle" class="ph-sub">{{ subtitle }}</p>
      </div>
    </div>
    <div class="ph-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    icon?: string
    accent?: 'brand' | 'teal' | 'orange' | 'violet' | 'green' | 'amber' | 'gray'
  }>(),
  { icon: 'dashboard', accent: 'brand', subtitle: '' },
)
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.ph-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.ph-ico {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: var(--sh-2);
  flex: none;
}
.accent-brand {
  background: linear-gradient(135deg, var(--brand-500), var(--brand-700));
}
.accent-teal {
  background: linear-gradient(135deg, #14c9b6, #0f8f82);
}
.accent-orange {
  background: linear-gradient(135deg, #ffa257, #f97316);
}
.accent-violet {
  background: linear-gradient(135deg, #9a7bff, #6d28d9);
}
.accent-green {
  background: linear-gradient(135deg, #34d399, #159e54);
}
.accent-amber {
  background: linear-gradient(135deg, #fbbf24, #d97706);
}
.accent-gray {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}
.ph-text {
  min-width: 0;
}
.ph-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: var(--ink-900);
  letter-spacing: -0.3px;
}
.ph-sub {
  margin: 3px 0 0;
  font-size: 13px;
  color: var(--ink-500);
}
.ph-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
