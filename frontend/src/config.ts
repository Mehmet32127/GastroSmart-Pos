// API Configuration - automatically detects backend host and protocol
const getApiBase = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  const { protocol, hostname } = window.location
  // For file:// (Electron) fall back to http://localhost
  const proto = protocol === 'file:' ? 'http:' : protocol
  const host  = hostname || 'localhost'
  const port  = import.meta.env.VITE_API_PORT || '3001'
  return `${proto}//${host}:${port}`
}

const getSocketBase = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  const { protocol, hostname } = window.location
  const proto = protocol === 'file:' ? 'http:' : protocol
  const host  = hostname || 'localhost'
  const port  = import.meta.env.VITE_API_PORT || '3001'
  return `${proto}//${host}:${port}`
}

export const CONFIG = {
  API_BASE: getApiBase(),
  SOCKET_BASE: getSocketBase(),
  APP_NAME: 'GastroSmart',
  VERSION: '1.0.0',
  JWT_STORAGE_KEY: 'gs_access_token',
  REFRESH_STORAGE_KEY: 'gs_refresh_token',
  OFFLINE_QUEUE_KEY: 'gs_offline_queue',
  THEME_STORAGE_KEY: 'gs_theme',
  HMAC_SECRET: import.meta.env.VITE_HMAC_SECRET || 'gastrosmart-offline-queue-secret-change-me',
  OFFLINE_RETRY_INTERVAL: 5000,
  SOCKET_RECONNECT_ATTEMPTS: 20,        // 10 -> 20 daha çok deneme
  SOCKET_TIMEOUT: 60000,                 // 60 saniye
  SOCKET_RECONNECT_DELAY_MIN: 1000,      // 1 saniye
  SOCKET_RECONNECT_DELAY_MAX: 5000,      // 5 saniye (10000 -> 5000)
  TOAST_DURATION: 3000,
} as const
