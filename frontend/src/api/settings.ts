import client from './client'
import type { Theme, ApiResponse } from '@/types'

export const settingsApi = {
  get: () =>
    client.get<ApiResponse<{
      restaurantName: string
      logoUrl?: string
      address?: string
      phone?: string
      taxNo?: string
      receiptFooter?: string
      currency: string
      timezone: string
      paperWidth?: '58mm' | '80mm'
    }>>('/settings'),

  update: (data: Record<string, unknown>) =>
    client.put<ApiResponse>('/settings', data),

  uploadLogo: (file: File) => {
    const formData = new FormData()
    formData.append('logo', file)
    return client.post<ApiResponse<{ url: string }>>('/settings/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  getTheme: () =>
    client.get<ApiResponse<Theme>>('/settings/theme'),

  updateTheme: (theme: Partial<Theme>) =>
    client.put<ApiResponse<Theme>>('/settings/theme', theme),
}
