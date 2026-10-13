import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 极简角色（交付隔离用，方案 §交付）。
 * - super：平台运营方 / 超级管理员，可见全部功能（含开发进度、本次更新、租户管理、演示开关）。
 * - seller：外部卖家租户，仅可见业务功能（订单/商品/渠道/承运商/试算/加价）。
 *
 * 演示阶段默认 super（平台方自己每天刷新仍能看到开发进度）；真实部署时角色应由登录后
 * 后端返回（JWT/会话中的 role 字段），本 store 仅负责前端显隐与本地模拟切换，不替代鉴权。
 */
export type UserRole = 'super' | 'seller'

const ROLE_KEY = 'mock-role-v1'

export const ROLE_LABELS: Record<UserRole, string> = {
  super: '平台运营方',
  seller: '卖家租户',
}

export const useUserStore = defineStore('user', () => {
  const role = ref<UserRole>((localStorage.getItem(ROLE_KEY) as UserRole) || 'super')
  const label = ref<string>(ROLE_LABELS[role.value] || ROLE_LABELS.super)

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

  return { role, label, setRole, ROLE_LABELS }
})
