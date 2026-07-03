import client from './client'
import type { ApiResponse } from '@/types'

export interface PreviewItem {
  name: string
  price: number
  description: string
  categoryName: string
  imageUrl: string
  externalId: string | null
}

export interface PreviewResult {
  adapter: string
  count: number
  items: PreviewItem[]
  warnings: string[]
}

export interface ImportCounts {
  added: number
  updated: number
  skipped: number
  deactivated: number
}

export interface Integration {
  id: string
  sourceUrl: string
  adapter: string | null
  importImages: boolean
  syncEnabled: boolean
  syncIntervalMinutes: number
  lastSyncedAt: string | null
  lastStatus: string | null
  lastError: string | null
  lastCounts: ImportCounts | null
  ownershipConfirmed: boolean
  updatedAt: string
}

export const integrationApi = {
  preview: (url: string, importImages: boolean) =>
    client.post<ApiResponse<PreviewResult>>('/integration/preview', { url, importImages }),

  import: (payload: { url: string; importImages: boolean; ownershipConfirmed: boolean; deactivateMissing?: boolean }) =>
    client.post<ApiResponse<{ counts: ImportCounts; adapter: string; warnings: string[]; integration: Integration }>>(
      '/integration/import',
      payload,
    ),

  list: () =>
    client.get<ApiResponse<Integration[]>>('/integration'),

  update: (id: string, data: { syncEnabled?: boolean; syncIntervalMinutes?: number; importImages?: boolean }) =>
    client.put<ApiResponse<Integration>>(`/integration/${id}`, data),

  remove: (id: string) =>
    client.delete<ApiResponse>(`/integration/${id}`),

  syncNow: (id: string) =>
    client.post<ApiResponse<{ counts: ImportCounts; integration: Integration }>>(`/integration/${id}/sync-now`),
}
