import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { useTenantStore } from '@/stores/tenant'
import router from '@/router'
import { mockRouter } from './mock-data'

/** 是否演示模式：未显式设置 VITE_USE_MOCK=false 即视为开（默认走 mock）。 */
export const IS_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') === 'true'

/**
 * 演示模式开关（见 src/env.d.ts）。
 * - true：所有请求由 src/api/mock-data.ts 在纯前端返回数据，无需后端 / 数据库，
 *   便于本地直接预览成果（默认开启，见 web/.env）。
 * - 生产 / 接入真实后端时设为 false（或删除 web/.env 的该变量），走下方 axios 真实请求。
 */
// 演示模式开关由上方 IS_MOCK 统一导出：未设置该变量（如全新克隆、未建 .env）时直接走 mock，
// 保证 `npm install && npm run dev` 即可看到成果；接真实后端时显式设为 false。

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
  (error) => {
    // 正式模式 401（令牌缺失/失效）：清空会话并跳转登录页（review 9.8 上线前置）。
    if (!IS_MOCK && error?.response?.status === 401) {
      const token = localStorage.getItem('token')
      if (token) localStorage.removeItem('token')
      if (router.currentRoute.value.name !== 'login') {
        router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
      }
    }
    return Promise.reject(error)
  },
)

/** 类型化请求方法：返回后端数据体 T，而非整个 AxiosResponse。 */
export interface TypedHttp {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T>
}

// 说明：响应拦截器已将 AxiosResponse 解包为数据体，
// 此处用一次类型断言把 axios 的 AxiosResponse<T> 抹平为 T。
// 演示模式（USE_MOCK）下绕过 axios，由 mockRouter 直接返回数据体。
export const http: TypedHttp = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    IS_MOCK ? (mockRouter('GET', url) as unknown as Promise<T>) : (instance.get(url, config) as unknown as Promise<T>),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    IS_MOCK
      ? (mockRouter('POST', url, data) as unknown as Promise<T>)
      : (instance.post(url, data, config) as unknown as Promise<T>),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    IS_MOCK
      ? (mockRouter('PUT', url, data) as unknown as Promise<T>)
      : (instance.put(url, data, config) as unknown as Promise<T>),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    IS_MOCK
      ? (mockRouter('PATCH', url, data) as unknown as Promise<T>)
      : (instance.patch(url, data, config) as unknown as Promise<T>),
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    IS_MOCK
      ? (mockRouter('DELETE', url) as unknown as Promise<T>)
      : (instance.delete(url, config) as unknown as Promise<T>),
}

export default http
