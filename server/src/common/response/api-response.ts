/**
 * 统一响应体（方案 §31：统一响应/异常）。
 * 约定：所有接口返回 ApiResponse<T>，code=0 表示成功，非 0 为业务异常。
 */
export interface ApiResponse<T = unknown> {
  code: number // 业务码：0=成功
  message: string // 提示信息
  data: T // 业务数据
  timestamp: string // 响应时间（ISO UTC）
}

/** 成功响应 */
export function ok<T>(data: T, message = 'success'): ApiResponse<T> {
  return { code: 0, message, data, timestamp: new Date().toISOString() }
}

/** 失败响应 */
export function fail(message: string, code = 1, data: unknown = null): ApiResponse {
  return { code, message, data, timestamp: new Date().toISOString() }
}
