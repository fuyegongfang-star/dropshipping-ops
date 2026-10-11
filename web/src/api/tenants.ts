import http from './http'

export interface Tenant {
  id: string
  name: string
  code: string
  status?: string
}

export const tenantsApi = {
  list: () => http.get<Tenant[]>('/tenants'),
  create: (name: string, code: string) => http.post<Tenant>('/tenants', { name, code }),
}
