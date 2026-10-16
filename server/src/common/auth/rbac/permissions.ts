/**
 * 权限点目录与角色蓝图（任务 4.5，方案 §22 精细化 RBAC）。
 *
 * 设计：以「权限点（permission）」为最小授权单元，角色是权限点的集合；
 * 用户通过 user_roles 获得一个或多个角色，运行时由 PermissionService 解出权限集合。
 * 作用域（scope，§22）按维度声明：all（全部）/ shop（店铺）/ warehouse（仓库）/ region（地区），
 * 用于把运营/仓管的可见数据收窄到指定维度（4.5 落地元数据与判定，查询级收窄随业务接口逐步接入）。
 */

/** 权限点分组（用于前端目录展示与按业务归类） */
export interface PermissionResource {
  group: string
  groupLabel: string
  items: { code: string; label: string }[]
}

export const PERMISSION_RESOURCES: PermissionResource[] = [
  {
    group: 'dashboard',
    groupLabel: '概览',
    items: [{ code: 'dashboard:view', label: '查看仪表盘' }],
  },
  {
    group: 'order',
    groupLabel: '订单',
    items: [
      { code: 'order:view', label: '查看订单' },
      { code: 'order:review', label: '审单' },
      { code: 'order:push', label: '推单/履约' },
    ],
  },
  {
    group: 'catalog',
    groupLabel: '商品/SKU',
    items: [
      { code: 'catalog:view', label: '查看商品' },
      { code: 'catalog:manage', label: '管理商品/SKU' },
    ],
  },
  {
    group: 'channel',
    groupLabel: '渠道',
    items: [
      { code: 'channel:view', label: '查看渠道' },
      { code: 'channel:manage', label: '管理渠道/拉单' },
    ],
  },
  {
    group: 'carrier',
    groupLabel: '承运商',
    items: [
      { code: 'carrier:view', label: '查看承运商' },
      { code: 'carrier:manage', label: '管理承运商/试算' },
    ],
  },
  {
    group: 'pricing',
    groupLabel: '运费/比价',
    items: [
      { code: 'pricing:view', label: '查看运费/比价' },
      { code: 'pricing:manage', label: '运营配置(加价/费率卡)' },
    ],
  },
  {
    group: 'shipment',
    groupLabel: '物流履约',
    items: [
      { code: 'shipment:view', label: '查看运单/轨迹' },
      { code: 'shipment:manage', label: '建单/面单/轨迹' },
    ],
  },
  {
    group: 'finance',
    groupLabel: '财务',
    items: [
      { code: 'finance:view', label: '查看账务/账单/利润' },
      { code: 'finance:manage', label: '充值/扣款/结算' },
    ],
  },
  {
    group: 'report',
    groupLabel: '报表',
    items: [{ code: 'report:view', label: '查看报表指标' }],
  },
  {
    group: 'rbac',
    groupLabel: '权限',
    items: [{ code: 'rbac:manage', label: '管理角色与权限' }],
  },
  {
    group: 'tenant',
    groupLabel: '平台',
    items: [{ code: 'tenant:manage', label: '租户管理(平台运营方)' }],
  },
  {
    group: 'settings',
    groupLabel: '系统',
    items: [{ code: 'settings:manage', label: '站点/系统设置' }],
  },
]

/** 扁平化全部权限点 */
export const ALL_PERMISSIONS: string[] = PERMISSION_RESOURCES.flatMap((r) => r.items.map((i) => i.code))

/** 角色蓝图：角色名 → 默认权限点集合（super_admin 含全部） */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [...ALL_PERMISSIONS],
  operator: [
    'dashboard:view',
    'order:view', 'order:review', 'order:push',
    'catalog:view', 'catalog:manage',
    'channel:view', 'channel:manage',
    'carrier:view', 'carrier:manage',
    'pricing:view',
    'shipment:view', 'shipment:manage',
    'report:view',
  ],
  finance: ['dashboard:view', 'order:view', 'finance:view', 'finance:manage', 'report:view'],
  warehouse: ['dashboard:view', 'order:view', 'catalog:view', 'shipment:view', 'shipment:manage'],
  cs: ['dashboard:view', 'order:view', 'shipment:view'],
}

/** 系统内置角色清单（front-end 可选项；tenant 自定义角色另存于 Role 表） */
export const SYSTEM_ROLES = Object.keys(ROLE_PERMISSIONS)

/** 作用域维度（§22：把角色权限收窄到指定数据范围） */
export type ScopeDimension = 'all' | 'shop' | 'warehouse' | 'region'

export const SCOPE_DIMENSIONS: { code: ScopeDimension; label: string }[] = [
  { code: 'all', label: '全部数据' },
  { code: 'shop', label: '指定店铺' },
  { code: 'warehouse', label: '指定仓库' },
  { code: 'region', label: '指定地区' },
]

/** 解析角色名集合为权限点集合（角色名未命中蓝图时视为无权限，防越权） */
export function resolvePermissions(roles: string[] | undefined): Set<string> {
  const perms = new Set<string>()
  for (const r of roles ?? []) {
    for (const p of ROLE_PERMISSIONS[r] ?? []) perms.add(p)
  }
  return perms
}

/** 作用域判定：资源作用域是否满足用户作用域（all 通配；维度+值需匹配） */
export function scopeMatches(userScope: string | null | undefined, resourceScope?: string | null): boolean {
  if (!userScope || userScope === 'all') return true
  if (!resourceScope) return true
  return userScope === resourceScope
}
