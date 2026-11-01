import { http } from './http'

/**
 * 登录接口封装（方案 §0/§22）。
 * 演示模式（IS_MOCK）下由 mock-data.ts 同口径返回；正式模式走 POST /api/auth/login。
 */
export interface LoginResult {
  token: string
}

/** 账号密码登录：tenantId + email + password → 后端签发绑定租户与角色的 JWT。 */
export async function login(email: string, password: string, tenantId: string): Promise<LoginResult> {
  return http.post<LoginResult>('/auth/login', { email, password, tenantId })
}
