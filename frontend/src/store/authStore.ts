import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { CONFIG } from '@/config'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  hasRole: (roles: User['role'][]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) => {
        localStorage.setItem(CONFIG.JWT_STORAGE_KEY, accessToken)
        localStorage.setItem(CONFIG.REFRESH_STORAGE_KEY, refreshToken)
        set({ accessToken, refreshToken, isAuthenticated: true })
      },

      clearAuth: () => {
        localStorage.removeItem(CONFIG.JWT_STORAGE_KEY)
        localStorage.removeItem(CONFIG.REFRESH_STORAGE_KEY)
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      setLoading: (isLoading) => set({ isLoading }),

      hasRole: (roles) => {
        const { user } = get()
        if (!user) return false
        return roles.includes(user.role)
      },
    }),
    {
      name: 'gs-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
