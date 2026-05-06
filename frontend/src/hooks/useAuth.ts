import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CONFIG } from '@/config'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api/auth'
import type { LoginCredentials } from '@/types'

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, setTokens, clearAuth, setLoading, hasRole } =
    useAuthStore()
  const navigate = useNavigate()
  const [loginError, setLoginError] = useState<string | null>(null)

  const login = async (credentials: LoginCredentials) => {
    setLoginError(null)
    setLoading(true)
    try {
      const { data } = await authApi.login(credentials)
      if (data.data) {
        const { user, tokens } = data.data
        setTokens(tokens.accessToken, tokens.refreshToken)
        setUser(user)
        toast.success(`Hoş geldiniz, ${user.fullName}!`)
        navigate('/')
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Giriş başarısız. Bilgilerinizi kontrol edin.'
      setLoginError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    // Slug'ı clearAuth ÖNCE oku — logout sonrası aynı tenant'a yönlendirelim
    const slugBefore = user?.tenantSlug
    try {
      const refreshToken = localStorage.getItem(CONFIG.REFRESH_STORAGE_KEY)
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // Ignore errors on logout
    } finally {
      clearAuth()
      navigate(slugBefore ? `/r/${slugBefore}/login` : '/login')
      toast.success('Çıkış yapıldı')
    }
  }

  const refreshUser = async () => {
    try {
      const { data } = await authApi.me()
      if (data.data) setUser(data.data)
    } catch {
      clearAuth()
    }
  }

  return { user, isAuthenticated, isLoading, loginError, login, logout, refreshUser, hasRole }
}
