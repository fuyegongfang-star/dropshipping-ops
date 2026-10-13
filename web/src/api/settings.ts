import http from './http'

/**
 * 站点设置接口封装（系统设置 → 站点设置）。
 * 覆盖站点名称与品牌标识、SEO/TDK 配置、第三方统计代码三大块；
 * 对接后端 `GET / PUT /settings/site`、`POST|PUT|DELETE /settings/tdk-rules`，
 * 演示模式下由 mock-data.ts 返回等价数据并以 localStorage 持久化。
 */

/** TDK 规则适用的页面类型 */
export type TdkPage = 'home' | 'product' | 'category' | 'quote' | 'article' | 'custom'

/** 单条页面 TDK 规则：模板支持 {site} {name} {category} 变量，前台渲染时替换。 */
export interface TdkRule {
  id: string
  page: TdkPage
  path: string
  titleTpl: string
  descTpl: string
  keywords: string
  enabled: boolean
  note: string
}

/** 站点设置（后台配置 → 前台门户与后台界面同时消费） */
export interface SiteSettings {
  siteName: string
  siteSlogan: string
  logoUrl: string
  faviconUrl: string
  domain: string
  icpNo: string
  copyright: string
  contactEmail: string
  contactPhone: string
  serviceTime: string
  lang: string
  timezone: string
  /** 标题分隔符，如 ' - ' / ' | ' / '_' */
  titleSeparator: string
  /** 标题是否追加站点名：always 总是 / home 仅首页 / never 不追加 */
  titleSuffix: 'always' | 'home' | 'never'
  homeTitle: string
  homeDesc: string
  homeKeywords: string
  /** 注入 <head> 的第三方代码（统计、像素等） */
  headCode: string
  /** 注入 <body> 末尾的第三方代码 */
  bodyCode: string
  /** 搜索引擎站长验证 meta 的 content 值 */
  verifyMeta: string
  robots: string
  sitemapEnabled: boolean
  tdkRules: TdkRule[]
  updatedAt: string
}

/** TDK 规则新增/编辑入参（id 由后端生成，新建时不含 id）。 */
export type TdkRuleInput = Omit<TdkRule, 'id'> & { id?: string }

/** 页面类型中文标签 */
export const TDK_PAGE_LABELS: Record<TdkPage, string> = {
  home: '首页',
  product: '商品详情',
  category: '品类聚合',
  quote: '运费试算',
  article: '资讯文章',
  custom: '自定义页',
}

/** 标题追加站点名方式中文标签 */
export const TITLE_SUFFIX_LABELS: Record<SiteSettings['titleSuffix'], string> = {
  always: '所有页面都追加',
  home: '仅首页追加',
  never: '不追加',
}

/** TDK 模板可用变量（前台渲染时替换） */
export const TDK_VARS: { var: string; desc: string }[] = [
  { var: '{site}', desc: '站点名称' },
  { var: '{name}', desc: '商品 / 文章标题' },
  { var: '{category}', desc: '商品类目' },
]

export const settingsApi = {
  /** 读取站点设置（含 TDK 规则表）。 */
  site: () => http.get<SiteSettings>('/settings/site'),
  /** 保存站点设置（部分字段更新）。 */
  updateSite: (patch: Partial<SiteSettings>) => http.put<SiteSettings>('/settings/site', patch),
  /** 新建页面 TDK 规则。 */
  createTdkRule: (rule: TdkRuleInput) => http.post<TdkRule>('/settings/tdk-rules', rule),
  /** 更新页面 TDK 规则（含启停）。 */
  updateTdkRule: (id: string, patch: Partial<TdkRuleInput>) =>
    http.put<TdkRule>(`/settings/tdk-rules/${id}`, patch),
  /** 删除页面 TDK 规则。 */
  removeTdkRule: (id: string) => http.delete<{ deleted: boolean }>(`/settings/tdk-rules/${id}`),
  /** 重置为初始站点设置（演示模式入口；正式环境后端可忽略）。 */
  resetSite: () => http.post<SiteSettings>('/settings/site/reset'),
}
