import client from './client'
import type { User, UserRole, ApiResponse } from '@/types'

export interface CreateUserPayload {
  username: string
  password: string
  fullName: string
  role: UserRole
  email?: string
  phone?: string
}

export interface UpdateUserPayload {
  fullName?: string
  role?: UserRole
  email?: string
  phone?: string
}

export const authPasswordApi = {
  // tenantSlug verilirse o restoran DB'sinde aranır, yoksa legacy demo
  forgotPassword: (email: string, tenantSlug?: string) =>
    client.post<ApiResponse>('/auth/forgot-password', { email, tenantSlug }),

  // Token "slug.hex" formatında olabilir — backend kendi parse ediyor
  resetPassword: (token: string, newPassword: string) =>
    client.post<ApiResponse>('/auth/reset-password', { token, newPassword }),
}

export const usersApi = {
  getAll: () =>
    client.get<ApiResponse<User[]>>('/users'),

  getById: (id: string) =>
    client.get<ApiResponse<User>>(`/users/${id}`),

  create: (data: CreateUserPayload) =>
    client.post<ApiResponse<User>>('/users', data),

  update: (id: string, data: UpdateUserPayload) =>
    client.patch<ApiResponse<User>>(`/users/${id}`, data),

  resetPassword: (id: string, newPassword: string) =>
    client.post<ApiResponse>(`/users/${id}/reset-password`, { newPassword }),

  toggleActive: (id: string) =>
    client.patch<ApiResponse<User>>(`/users/${id}/toggle`),

  delete: (id: string) =>
    client.delete<ApiResponse>(`/users/${id}`),
}
