import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 租户状态（方案 §0/§17）。
 * 前端选中租户后，所有请求经 http 拦截器携带 x-tenant-id 透传后端，后端据此做行级隔离。
 */
export const useTenantStore = defineStore('tenant', () => {
  const currentTenantCode = ref<string>('')
  const tenants = ref<{ code: string; name: string }[]>([])

  /** 切换租户并持久化（§27 多语言/多币种可在此基础上扩展） */
  function setTenant(code: string): void {
    currentTenantCode.value = code
    localStorage.setItem('tenantCode', code)
  }

  function loadFromStorage(): void {
    currentTenantCode.value = localStorage.getItem('tenantCode') ?? ''
  }

  return { currentTenantCode, tenants, setTenant, loadFromStorage }
})
