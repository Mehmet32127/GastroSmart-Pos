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
}
