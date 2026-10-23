import { ref } from 'vue'

/**
 * 轻量国际化 + 多币种前端（任务 4.9，方案 §27）。
 *
 * 设计决策（无人值守安全优先）：不引入 vue-i18n 第三方依赖（安装可能触发本机
 * safe-delete 守卫导致 build 中断），改用同形态的「字典 + 响应式 locale + t()」实现，
 * 语义与 vue-i18n 一致，可日后平移。币种换算复用 §10.3 汇率口径（基准币 CNY）。
 *
 * - 记账 / 后端始终以基准币 CNY 存储；前端按商户所选「展示币种」换算显示（§27）。
 * - locale / displayCurrency 持久化到 localStorage，刷新后保持。
 */

export type Locale = 'zh' | 'en'
export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'GBP'

/** 展示币种 → 汇率（值 = 1 单位该币种等于多少基准币 CNY，§10.3 内存种子口径）。 */
export const FX_RATES: Record<CurrencyCode, number> = {
  CNY: 1,
  USD: 7.2,
  EUR: 7.8,
  GBP: 9.1,
}

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
}

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  CNY: '人民币 CNY',
  USD: '美元 USD',
  EUR: '欧元 EUR',
  GBP: '英镑 GBP',
}

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
}

const zh: Record<string, string> = {
  'app.demo': '演示模式',
  'topbar.tenant': '租户',
  'topbar.role': '身份',
  'topbar.language': '语言',
  'topbar.currency': '展示币种',
  'common.refresh': '刷新',
  'common.new': '新建',
  'common.confirm': '确认',
  'common.cancel': '取消',
  'menu.dashboard': '仪表盘',
  'menu.orders': '订单中心',
  'menu.catalog': '商品 / SKU',
  'menu.channels': '渠道 / 店铺',
  'menu.amazon': 'Amazon 对接',
  'menu.suppliersDropship': '供应商代发',
  'menu.warehouse': '仓储管理',
  'menu.reports': '运营报表',
  'menu.carriers': '承运商管理',
  'menu.quotes': '运费试算',
  'menu.fulfillment': '履约路由',
  'menu.shipments': '两段式运单',
  'menu.address': '地址校验',
  'menu.aggregator': '聚合追踪',
  'menu.shipmentTracking': '物流回传与轨迹',
  'menu.wallet': '收款账务',
  'menu.billing': '商户账单',
  'menu.profit': '利润核算',
  'menu.claims': '理赔保险',
  'menu.risk': '风控中心',
  'menu.pricing': '运营配置',
  'menu.localization': '本地化设置',
  'menu.siteSettings': '站点设置',
  'menu.tenants': '租户管理',
  'menu.progress': '开发进度',
  'menu.security': '安全加固',
  'menu.capacity': '容量与灾备',
  'menu.rbac': '权限管理',
  'menu.openPlatform': '开放平台',
  'group.business': '业务运营',
  'group.logistics': '物流履约',
  'group.finance': '财务中心',
  'group.system': '系统设置',
}

const en: Record<string, string> = {
  'app.demo': 'Demo Mode',
  'topbar.tenant': 'Tenant',
  'topbar.role': 'Role',
  'topbar.language': 'Language',
  'topbar.currency': 'Display Currency',
  'common.refresh': 'Refresh',
  'common.new': 'New',
  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel',
  'menu.dashboard': 'Dashboard',
  'menu.orders': 'Orders',
  'menu.catalog': 'Catalog / SKU',
  'menu.channels': 'Channels / Shops',
  'menu.amazon': 'Amazon SP-API',
  'menu.suppliersDropship': 'Supplier Dropship',
  'menu.warehouse': 'Warehouse',
  'menu.reports': 'Reports',
  'menu.carriers': 'Carriers',
  'menu.quotes': 'Quote',
  'menu.fulfillment': 'Fulfillment Route',
  'menu.shipments': 'Two-Leg Shipments',
  'menu.address': 'Address Check',
  'menu.aggregator': 'Aggregator Tracking',
  'menu.shipmentTracking': 'Logistics Callback & Tracking',
  'menu.wallet': 'Wallet',
  'menu.billing': 'Billing',
  'menu.profit': 'Profit',
  'menu.claims': 'Claims',
  'menu.risk': 'Risk Control',
  'menu.pricing': 'Operations Config',
  'menu.localization': 'Localization',
  'menu.siteSettings': 'Site Settings',
  'menu.tenants': 'Tenants',
  'menu.progress': 'Dev Progress',
  'menu.security': 'Security',
  'menu.capacity': 'Capacity & DR',
  'menu.rbac': 'RBAC',
  'menu.openPlatform': 'Open Platform',
  'group.business': 'Business',
  'group.logistics': 'Logistics',
  'group.finance': 'Finance',
  'group.system': 'System',
}

// 响应式语言与展示币种（持久化到 localStorage，刷新后保持）
export const locale = ref<Locale>(
  (localStorage.getItem('app_locale') as Locale) || 'zh',
)
export const displayCurrency = ref<CurrencyCode>(
  (localStorage.getItem('app_currency') as CurrencyCode) || 'CNY',
)

/** 切换语言并持久化。 */
export function setLocale(l: Locale): void {
  locale.value = l
  localStorage.setItem('app_locale', l)
  document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN'
}

/** 切换展示币种并持久化。 */
export function setCurrency(c: CurrencyCode): void {
  displayCurrency.value = c
  localStorage.setItem('app_currency', c)
}

// 初始化一次 lang 属性
document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'

/** 取翻译文案：依次回退 当前语言 → 中文 → 原文 key，保证缺失不崩。 */
export function t(key: string): string {
  const dict = locale.value === 'en' ? en : zh
  return dict[key] ?? zh[key] ?? key
}

/** 将基准币 CNY 金额按当前展示币种换算并格式化（含符号，千分位）。 */
export function money(amountCny: number): string {
  const rate = FX_RATES[displayCurrency.value] ?? 1
  const v = (amountCny ?? 0) / rate
  return (
    CURRENCY_SYMBOLS[displayCurrency.value] +
    v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  )
}

/** 仅换算数值（图表等需要裸数字时使用）。 */
export function toDisplay(amountCny: number): number {
  const rate = FX_RATES[displayCurrency.value] ?? 1
  return (amountCny ?? 0) / rate
}
