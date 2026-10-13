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

/** 品牌图片资源类型：站点 LOGO / 浏览器标签图标。 */
export type BrandAssetKind = 'logo' | 'favicon'

/**
 * 品牌图片规格：上传组件据此做「校验 + 尺寸提示 + 自动压缩」。
 * 站点 LOGO 在后台侧栏以正方形图标呈现（44×44 圆角），浏览器 favicon 同样是正方形，
 * 故两者都按 1:1 处理，避免横版图被拉伸变形。
 */
export interface BrandAssetSpec {
  kind: BrandAssetKind
  /** 展示名 */
  title: string
  /** 建议上传尺寸（正方形边长，px） */
  recommend: number
  /** 最小可用尺寸（小于该值会明显模糊，仅提示不拦截） */
  min: number
  /** 压缩落盘尺寸（正方形边长，px）—— 兼顾高清屏与体积 */
  output: number
  /** 源文件体积上限（KB），超过直接拒绝 */
  maxSourceKB: number
  /** 允许的 MIME 类型 */
  accept: string[]
  /** 允许的扩展名（部分浏览器对 SVG/ICO 的 MIME 判定为空，用扩展名兜底） */
  ext: string[]
  /** 使用场景说明 */
  usage: string
}

/** 站点 LOGO 规格：建议 512×512 方图。 */
export const LOGO_SPEC: BrandAssetSpec = {
  kind: 'logo',
  title: '站点 LOGO',
  recommend: 512,
  min: 64,
  output: 512,
  maxSourceKB: 2048,
  accept: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  ext: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
  usage: '显示于后台侧栏 LOGO（正方形图标）与前台导航',
}

/** 浏览器 favicon 规格：建议 64×64（或 32×32）方图。 */
export const FAVICON_SPEC: BrandAssetSpec = {
  kind: 'favicon',
  title: 'Favicon',
  recommend: 64,
  min: 32,
  output: 64,
  maxSourceKB: 512,
  accept: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  ext: ['png', 'ico', 'jpg', 'jpeg', 'webp', 'svg'],
  usage: '显示于浏览器标签页与收藏夹',
}

/** 按类型取规格（上传组件的唯一入口）。 */
export const BRAND_ASSET_SPECS: Record<BrandAssetKind, BrandAssetSpec> = {
  logo: LOGO_SPEC,
  favicon: FAVICON_SPEC,
}

/** 上传入参：为避免演示模式（纯前端）无法模拟 multipart，统一以压缩后的 dataURL 承载。 */
export interface UploadAssetPayload {
  kind: BrandAssetKind
  /** 压缩后的 dataURL（正式环境后端解码后存入对象存储） */
  dataUrl: string
  /** 原始文件名（便于后端命名与追溯） */
  name: string
  width: number
  height: number
}

/** 上传结果：正式环境返回对象存储 / CDN 地址，演示模式直接回吐 dataURL。 */
export interface UploadAssetResult {
  url: string
  kind: BrandAssetKind
  name: string
  width: number
  height: number
  bytes: number
  mime: string
  /** demo-local 表示演示模式未落存储 */
  storage: string
  uploadedAt: string
}

export const settingsApi = {
  /** 读取站点设置（含 TDK 规则表）。 */
  site: () => http.get<SiteSettings>('/settings/site'),
  /** 保存站点设置（部分字段更新）。 */
  updateSite: (patch: Partial<SiteSettings>) => http.put<SiteSettings>('/settings/site', patch),
  /** 上传品牌图片（LOGO / Favicon），返回可直接写入 logoUrl / faviconUrl 的地址。 */
  uploadAsset: (payload: UploadAssetPayload) =>
    http.post<UploadAssetResult>('/settings/assets', payload),
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
