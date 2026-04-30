import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { CONFIG } from '@/config'
import { useAuthStore } from '@/store/authStore'

const client = axios.create({
  baseURL: `${CONFIG.API_BASE}/api`,
  // Render free tier cold start ~30-60s sürebilir, ilk istekleri kesmeyelim
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Cold start retry ──────────────────────────────────────────────────────────
// Network error (timeout / connection refused / 502/503/504) durumunda
// exponential backoff ile 3 kere tekrar dener. Render servis uyuyorsa
// bu süreçte uyanıyor.
type RetryableConfig = InternalAxiosRequestConfig & { _retryCount?: number }

const MAX_RETRIES   = 3
const RETRY_BASE_MS = 2000

async function shouldRetry(err: AxiosError): Promise<boolean> {
  // 5xx veya network error
  const status = err.response?.status
  if (!err.response) return true                    // network/timeout
  if (status && status >= 500 && status < 600) return true
  return false
}

async function retryRequest(err: AxiosError) {
  const cfg = err.config as RetryableConfig | undefined
  if (!cfg) return Promise.reject(err)

  cfg._retryCount = cfg._retryCount ?? 0
  if (cfg._retryCount >= MAX_RETRIES) return Promise.reject(err)

  if (!(await shouldRetry(err))) return Promise.reject(err)

  cfg._retryCount += 1
  const delay = RETRY_BASE_MS * Math.pow(2, cfg._retryCount - 1)
  await new Promise((r) => setTimeout(r, delay))
  return client(cfg)
}

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

    // 5xx / network error → cold start retry
    if (err.response?.status !== 401) {
      return retryRequest(err)
    }

    // 401 değilse veya zaten retry denendiyse direkt hata fırlat
    if (!original || original._retry) {
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
