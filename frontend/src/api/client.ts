import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { CONFIG } from '@/config'
import { useAuthStore } from '@/store/authStore'

const client = axios.create({
  baseURL: `${CONFIG.API_BASE}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Token refresh queue ───────────────────────────────────────────────────────
// Birden fazla istek aynı anda 401 alırsa, sadece bir refresh yapılır.
// Diğer istekler kuyruğa alınır ve refresh tamamlanınca yeniden denenir.

let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject:  (err: unknown) => void
}> = []

function flushQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else       resolve(token!)
  })
  pendingQueue = []
}

// ── Request interceptor — token ekle ─────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Response interceptor — 401'de token yenile, isteği tekrarla ──────────────
type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

client.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as RetryConfig | undefined

    // 401 değilse veya zaten retry denendiyse direkt hata fırlat
    if (err.response?.status !== 401 || !original || original._retry) {
      return Promise.reject(err)
    }

    const { refreshToken, setTokens, clearAuth } = useAuthStore.getState()

    // Refresh token yoksa → logout
    if (!refreshToken) {
      clearAuth()
      return Promise.reject(err)
    }

    // Başka bir refresh zaten sürüyorsa kuyruğa gir
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      })
        .then((newToken) => {
          original.headers!.Authorization = `Bearer ${newToken}`
          return client(original)
        })
        .catch(() => Promise.reject(err))
    }

    original._retry = true
    isRefreshing    = true

    try {
      // Doğrudan axios kullan — client kullanırsak sonsuz döngü riski var
      const { data } = await axios.post(
        `${CONFIG.API_BASE}/api/auth/refresh`,
        { refreshToken }
      )
      const newAccess  = data.data.accessToken  as string
      const newRefresh = data.data.refreshToken as string

      setTokens(newAccess, newRefresh)
      flushQueue(null, newAccess)

      original.headers!.Authorization = `Bearer ${newAccess}`
      return client(original)
    } catch (refreshErr) {
      flushQueue(refreshErr, null)
      clearAuth()
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  }
)

export default client
