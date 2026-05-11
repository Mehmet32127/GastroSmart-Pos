import client from './client'
import type { LoginCredentials, User, AuthTokens, ApiResponse } from '@/types'

export const authApi = {
  login: (credentials: LoginCredentials) =>
    client.post<ApiResponse<{ user: User; tokens: AuthTokens }>>('/auth/login', credentials),

  logout: (refreshToken: string) =>
    client.post<ApiResponse>('/auth/logout', { refreshToken }),

  refresh: (refreshToken: string) =>
    client.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', { refreshToken }),

  me: () =>
    client.get<ApiResponse<User>>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    client.post<ApiResponse>('/auth/change-password', { currentPassword, newPassword }),

  updateProfile: (data: { username?: string; fullName?: string; email?: string; phone?: string }) =>
    client.patch<ApiResponse<User & { requireRelogin?: boolean }>>('/auth/profile', data),

  // Lock screen için: mevcut session şifresini doğrula (token üretmez)
  verifyPassword: (password: string) =>
    client.post<ApiResponse>('/auth/verify-password', { password }),

  // Kişisel tercihler (tema, ses, kısayollar)
  updatePreferences: (prefs: Partial<{
    theme: 'dark' | 'light' | 'system'
    accentColor: string | null
    soundEnabled: boolean
    shortcutsEnabled: boolean
  }>) => client.patch<ApiResponse>('/auth/preferences', prefs),

  // Avatar upload
  uploadAvatar: (file: File) => {
    const formData = new FormData()
    formData.append('avatar', file)
    return client.post<ApiResponse<{ url: string }>>('/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAvatar: () => client.delete<ApiResponse>('/auth/avatar'),
}
