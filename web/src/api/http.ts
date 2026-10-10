import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useTenantStore } from '@/stores/tenant'

/**
 * 统一 HTTP 客户端（方案 §11/§31）。
 * 关键：每个请求自动注入当前租户标识（x-tenant-id）与鉴权令牌；
 * 后端据此完成「租户 + 用户」双约束与行级隔离（§0/§17）。
 *
 * 设计：响应拦截器已把后端 ApiResponse 解包为 `data` 本体，
 * 故下方封装方法的返回类型直接标注为 T（数据体），调用方无需再 .data。
 */
const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截：注入租户标识与鉴权令牌
instance.interceptors.request.use((config) => {
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
instance.interceptors.response.use(
  (resp: AxiosResponse) => {
    const body = resp.data
    if (body && typeof body.code === 'number' && body.code !== 0) {
      return Promise.reject(new Error(body.message ?? '请求失败'))
    }
    return body?.data ?? body
  },
  (error) => Promise.reject(error),
)

/** 类型化请求方法：返回后端数据体 T，而非整个 AxiosResponse。 */
export interface TypedHttp {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

// 说明：响应拦截器已将 AxiosResponse 解包为数据体，
// 此处用一次类型断言把 axios 的 AxiosResponse<T> 抹平为 T。
export const http: TypedHttp = {
  get: <T>(url: string, config?: AxiosRequestConfig) => instance.get(url, config) as unknown as Promise<T>,
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    instance.post(url, data, config) as unknown as Promise<T>,
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    instance.put(url, data, config) as unknown as Promise<T>,
  delete: <T>(url: string, config?: AxiosRequestConfig) => instance.delete(url, config) as unknown as Promise<T>,
}

export default http
