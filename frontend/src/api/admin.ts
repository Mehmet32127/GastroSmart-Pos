/**
 * Süper-admin API çağrıları — multi-tenant yönetimi.
 * Tenant kullanıcı API'sinden ayrı, kendi token'ını adminAuthStore'dan alır.
 */
import axios from 'axios'
import { CONFIG } from '@/config'
import { useAdminAuthStore } from '@/store/adminAuthStore'

const adminClient = axios.create({
  baseURL: `${CONFIG.API_BASE}/api/admin`,
  timeout: 15000,
})

adminClient.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

adminClient.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401: token süresi geçmiş veya geçersiz — logout
    if (err.response?.status === 401) {
      useAdminAuthStore.getState().logout()
    }
    return Promise.reject(err)
  }
)

export interface Tenant {
  slug: string
  name: string
  dbName: string
  plan: 'trial' | 'starter' | 'pro'
  active: boolean
  contactEmail: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTenantPayload {
  slug: string
  name: string
  contactEmail?: string
  adminEmail: string
  adminUsername?: string
  adminPassword?: string
  plan?: 'trial' | 'starter' | 'pro'
  notes?: string
}

export interface CreateTenantResponse {
  tenant: Tenant
  adminUsername: string
  adminTempPassword: string | null
}

export const adminApi = {
  login: (email: string, password: string) =>
    adminClient.post<{ success: boolean; data: { token: string; email: string } }>('/login', { email, password }),

  listTenants: () =>
    adminClient.get<{ success: boolean; data: Tenant[] }>('/tenants'),

  createTenant: (data: CreateTenantPayload) =>
    adminClient.post<{ success: boolean; data: CreateTenantResponse; message?: string }>('/tenants', data),

  updateTenant: (slug: string, data: Partial<Pick<Tenant, 'name' | 'plan' | 'active' | 'contactEmail' | 'notes'>>) =>
    adminClient.patch<{ success: boolean; data: Tenant }>(`/tenants/${slug}`, data),

  deleteTenant: (slug: string) =>
    adminClient.delete<{ success: boolean; data: Tenant }>(`/tenants/${slug}`),
}
