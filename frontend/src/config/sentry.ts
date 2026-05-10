/**
 * Sentry frontend error tracking.
 * VITE_SENTRY_DSN env'i ile aktif olur (build-time). Yoksa no-op.
 */
import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined
const ENV = import.meta.env.MODE

let initialized = false

export function initSentry() {
  if (!DSN) {
    if (ENV === 'production') {
      console.warn('[SENTRY] VITE_SENTRY_DSN ayarlanmamış — frontend error tracking devre dışı')
    }
    return false
  }

  Sentry.init({
    dsn:                DSN,
    environment:        ENV,
    release:            (import.meta.env.VITE_RELEASE_VERSION as string) || 'gastrosmart-frontend@1.0.0',
    tracesSampleRate:   ENV === 'production' ? 0.5 : 0.1,
    replaysSessionSampleRate:  0,    // Sadece hata olunca replay
    replaysOnErrorSampleRate:  1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText:   true,   // Şifre/PII maskelensin
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    // Sensitive verileri filtrele
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization
        delete event.request.headers.authorization
      }
      return event
    },
  })

  initialized = true
  return true
}

export function isSentryActive() { return initialized }

export { Sentry }
