import axios from 'axios'
import { useTenantStore } from '@/stores/tenant'

/**
 * 统一 HTTP 客户端（方案 §11/§31）。
 * 关键：每个请求自动注入当前租户标识（x-tenant-id）与鉴权令牌；
 * 后端据此完成「租户 + 用户」双约束与行级隔离（§0/§17）。
 */
const http = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const store = useTenantStore()
  if (store.currentTenantCode) {
    config.headers['x-tenant-id'] = store.currentTenantCode
  }
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 响应拦截：解包后端 ApiResponse（code=0 成功，其余视为业务错误抛出）
http.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && typeof body.code === 'number' && body.code !== 0) {
      return Promise.reject(new Error(body.message ?? '请求失败'))
    }
    return body?.data ?? body
  },
  (error) => Promise.reject(error),
)

export default http
