import {
  PERMISSION_RESOURCES,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  resolvePermissions,
  scopeMatches,
  SYSTEM_ROLES,
} from './permissions'

describe('RBAC 权限目录与解析 (§22)', () => {
  it('权限目录覆盖全部权限点且非空', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThan(0)
    const flat = PERMISSION_RESOURCES.flatMap((r) => r.items.map((i) => i.code))
    expect(flat).toEqual(ALL_PERMISSIONS)
    // 每个权限点有可读标签
    for (const code of ALL_PERMISSIONS) {
      expect(flat.includes(code)).toBe(true)
    }
  })

  it('super_admin 拥有全部权限；其余角色为其子集', () => {
    const all = new Set(ALL_PERMISSIONS)
    const superPerms = new Set(ROLE_PERMISSIONS['super_admin'])
    expect(superPerms.size).toBe(all.size)
    for (const role of SYSTEM_ROLES) {
      if (role === 'super_admin') continue
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(all.has(p)).toBe(true) // 不引用不存在的权限点
      }
    }
  })

  it('resolvePermissions 合并多角色权限点', () => {
    const perms = resolvePermissions(['finance', 'cs'])
    expect(perms.has('finance:view')).toBe(true)
    expect(perms.has('order:view')).toBe(true)
    expect(perms.has('order:push')).toBe(false) // 仅 finance/cs 不应含推单
  })

  it('未知角色不产生权限（防越权）', () => {
    expect(resolvePermissions(['ghost']).size).toBe(0)
    expect(resolvePermissions(undefined).size).toBe(0)
  })

  it('scopeMatches：all/未声明 通配，维度需匹配', () => {
    expect(scopeMatches(null, 'shop:1')).toBe(true)
    expect(scopeMatches('all', 'shop:1')).toBe(true)
    expect(scopeMatches('shop:1', 'shop:1')).toBe(true)
    expect(scopeMatches('shop:1', 'shop:2')).toBe(false)
    expect(scopeMatches('shop:1', undefined)).toBe(true)
  })
})
