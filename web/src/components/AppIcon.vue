<template>
  <!-- 零依赖内联 SVG 线性图标集（物流 / 货代后台场景）。
       颜色继承 currentColor，尺寸由 size 控制，stroke 风格统一。 -->
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="app-icon"
    aria-hidden="true"
  >
    <!-- path 来自本文件内的 ICONS 常量字典（非用户输入，无 XSS 风险），
         故此处豁免 vue/no-v-html 以注入 SVG 子片段。 -->
    <!-- eslint-disable-next-line vue/no-v-html -->
    <g v-html="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    strokeWidth?: number
  }>(),
  { size: 18, strokeWidth: 1.8 },
)

// 每个图标为 SVG 内部片段（path / circle 等）。统一线性风格。
const ICONS: Record<string, string> = {
  dashboard:
    '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  orders:
    '<path d="M9 4h7a2 2 0 0 1 2 2v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2z"/><path d="M9 4v3h7V4"/><path d="M8.5 12h7M8.5 16h5"/>',
  catalog:
    '<path d="M3.5 7.5 12 4l8.5 3.5v9L12 20l-8.5-3.5z"/><path d="M3.5 7.5 12 11l8.5-3.5M12 11v9"/>',
  channels:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 6h7M6 8.5v7a2 2 0 0 0 2 2h7"/>',
  tenants:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.5a3 3 0 0 1 0 5.8M17.5 19a5.3 5.3 0 0 0-2.4-4.4"/>',
  refresh:
    '<path d="M20 11a8 8 0 1 0-2.3 5.6"/><path d="M20 5v6h-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell:
    '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10.5 19a1.5 1.5 0 0 0 3 0"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>',
  box: '<path d="M3.5 7.5 12 4l8.5 3.5v9L12 20l-8.5-3.5z"/><path d="M3.5 7.5 12 11l8.5-3.5M12 11v9"/>',
  truck:
    '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
  money:
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.2c0-1.2 1.1-1.8 2.5-1.8s2.5.6 2.5 1.8-1.1 1.6-2.5 1.6-2.5.5-2.5 1.7 1.1 1.9 2.5 1.9 2.5-.7 2.5-1.9"/>',
  shop:
    '<path d="M4 9h16l-1-4H5z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  building:
    '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
  package:
    '<path d="M3.5 7.5 12 4l8.5 3.5v9L12 20l-8.5-3.5z"/><path d="M3.5 7.5 12 11l8.5-3.5M12 11v9"/>',
  warehouse:
    '<path d="M3 21V9l9-5 9 5v12"/><path d="M7 21v-7h10v7"/><path d="M7 13h10"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  swap:
    '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  globe:
    '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.5 2.5 13 0 16M12 4c-2.5 2.5-2.5 13 0 16"/>',
  layers:
    '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  warning: '<path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  calculator:
    '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M8 7h8"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  sliders:
    '<path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.2"/><circle cx="9" cy="16" r="2.2"/>',
  shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  key: '<circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16 16l2-2M14 18l2-2"/>',
  bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  coins:
    '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M14 12.5c0 1.4 2.2 2.5 5 2.5s1-1.1 1-2.5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 5h11l-2 3 2 3H6"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.2l2.8 1.6"/>',
  select:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14.5 5.5 18.5 9.5"/>',
  trash:
    '<path d="M5 7h14"/><path d="M8 7V5h8v2"/><path d="M6.5 7l.8 12.2A1 1 0 0 0 8.3 20h7.4a1 1 0 0 0 1-0.8L17.5 7"/><path d="M10 11v6M14 11v6"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  sparkle:
    '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z"/><path d="M18.5 17.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  rocket:
    '<path d="M13.5 4.5c3.5-1 6-0.5 6-0.5s.5 2.5-.5 6c-.8 2.8-2.6 5-5.5 6.5L9 12.5C10.5 9.6 12.7 7.3 13.5 4.5z"/><path d="M9 12.5 6.5 15 5 19l4-1.5 2.5-2.5"/><circle cx="15" cy="9" r="1.4"/>',
  grid:
    '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  print:
    '<path d="M7 8V3h10v5"/><path d="M5 8h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><path d="M7 14h10v7H7z"/><path d="M9 11h6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7"/>',
  upload: '<path d="M12 16V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  image:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.2a1.5 1.5 0 0 1 2 0L14 16l2-1.8a1.5 1.5 0 0 1 2 0L20.5 16"/>',
  link: '<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
  radar:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 12 19 6"/><path d="M12 12 5.5 15"/><circle cx="12" cy="12" r="1.6"/>',
  pin:
    '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.6"/>',
  wallet:
    '<path d="M3 8.5A2 2 0 0 1 5 6.5h12a2 2 0 0 1 2 2V9H3z"/><rect x="3" y="9" width="18" height="10" rx="2.2"/><circle cx="16.5" cy="14" r="1.3"/>',
  bill:
    '<path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M8.5 12h7M8.5 15.5h7M8.5 8.5h3"/>',
  calendar:
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/>',
  'arrow-down': '<path d="M12 5v14M6 13l6 6 6-6"/>',
  'arrow-up': '<path d="M12 19V5M6 11l6-6 6 6"/>',
  trend: '<path d="M4 17l5-5 3 3 7-7"/><path d="M15 8h4v4"/>',
  percent: '<path d="M6 18 18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
}

const path = computed(() => ICONS[props.name] ?? ICONS.box)
</script>

<style scoped>
.app-icon {
  display: inline-block;
  vertical-align: middle;
  flex: none;
}
</style>
