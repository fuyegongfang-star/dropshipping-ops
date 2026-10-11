import http from './http'

export interface PlatformInfo {
  platform: string
  supported: boolean
  note?: string
}

export interface Shop {
  id: string
  tenantId: string
  platform: string
  name: string
  authConfig?: Record<string, unknown> | null
  createdAt: string
}

export interface PullSummary {
  shopId: string
  platform: string
  created: number
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

export const channelsApi = {
  platforms: () => http.get<string[]>('/channels/platforms'),
  shops: () => http.get<Shop[]>('/shops'),
  pull: (shopId: string) => http.post<PullSummary>(`/channels/${shopId}/pull`, {}),
}
