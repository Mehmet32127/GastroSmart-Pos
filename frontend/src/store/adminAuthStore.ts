/**
 * Süper-admin auth state — sistem sahibi (sen) için.
 * Tenant kullanıcılarından (mevcut authStore) tamamen ayrı bir akış.
 *
 * Token'ı localStorage'da `gastro_admin_token` anahtarıyla tutar.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminAuthState {
  token: string | null
  email: string | null
  isAuthenticated: boolean

  setSession: (token: string, email: string) => void
  logout: () => void
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      isAuthenticated: false,

      setSession: (token, email) => set({ token, email, isAuthenticated: true }),
      logout: () => set({ token: null, email: null, isAuthenticated: false }),
    }),
    {
      name: 'gastro_admin_token',
      partialize: (state) => ({
        token: state.token,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
