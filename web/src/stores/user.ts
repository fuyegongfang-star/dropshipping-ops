import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * 用户会话与角色（交付隔离 + 正式登录，方案 §0/§22/§交付）。
 * - super：平台运营方 / 超级管理员，可见全部功能（含开发进度、本次更新、租户管理、演示开关）。
 * - seller：外部卖家租户，仅可见业务功能（订单/商品/渠道/承运商/试算/加价）。
 *
 * 演示阶段默认 super（平台方自己每天刷新仍能看到开发进度）；真实部署时由登录后
 * 后端 JWT 返回（role / tenantId），本 store 在登录流程中写入。
 *
 * 令牌：正式模式登录后存 localStorage('token')，HTTP 拦截器自动注入 Bearer（见 src/api/http.ts）；
 * 演示模式（VITE_USE_MOCK）不弹登录，store 预置一个 demo 用户以便界面渲染。
 */
export type UserRole = 'super' | 'seller'

const ROLE_KEY = 'mock-role-v1'
const TOKEN_KEY = 'token'
const USER_KEY = 'auth-user-v1'

export const ROLE_LABELS: Record<UserRole, string> = {
  super: '平台运营方',
  seller: '卖家租户',
}

export interface AuthUser {
  id?: string
  email: string
  tenantId: string
  roles: UserRole[]
}

export const useUserStore = defineStore('user', () => {
  const role = ref<UserRole>((localStorage.getItem(ROLE_KEY) as UserRole) || 'super')
  const label = ref<string>(ROLE_LABELS[role.value] || ROLE_LABELS.super)
  // 令牌与登录态：仅正式模式（非 mock）生效；演示模式恒为已登录的 demo 用户。
  const token = ref<string>(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref<AuthUser | null>(readStoredUser())

  /** 是否已登录：正式模式看 token，演示模式恒 true（无登录页）。 */
  const isLoggedIn = computed(() => {
    const isMock = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'
    return isMock || !!token.value
  })

  /** 切换身份（演示用）。真实部署时由登录流程写入 role。 */
  function setRole(next: UserRole): void {
    role.value = next
    label.value = ROLE_LABELS[next]
    try {
      localStorage.setItem(ROLE_KEY, next)
    } catch {
      /* 隐私模式忽略 */
    }
  }

  /** 正式模式登录成功：写入令牌 + 用户上下文（tenantId / role 来自 JWT 后端）。 */
  function login(payload: { token: string; user?: Partial<AuthUser> }): void {
    token.value = payload.token
    try {
      localStorage.setItem(TOKEN_KEY, payload.token)
    } catch {
      /* 隐私模式忽略 */
    }
    if (payload.user) {
      user.value = {
        id: payload.user.id,
        email: payload.user.email ?? user.value?.email ?? '',
        tenantId: payload.user.tenantId ?? user.value?.tenantId ?? '',
        roles: payload.user.roles ?? user.value?.roles ?? [role.value],
      }
      if (user.value.roles.length) setRole(user.value.roles[0])
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
      } catch {
        /* 隐私模式忽略 */
      }
    }
  }

  /** 退出登录：清令牌与上下文（演示模式仅清角色态）。 */
  function logout(): void {
    token.value = ''
    user.value = null
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    } catch {
      /* 隐私模式忽略 */
    }
  }

  return { role, label, token, user, isLoggedIn, setRole, login, logout, ROLE_LABELS }
})

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}
