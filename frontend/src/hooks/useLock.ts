import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

/**
 * Lock screen state — paylaşımlı bilgisayar/tablet senaryosu için.
 *
 * Davranış:
 *   - Manuel kilit: kullanıcı sidebar'dan "Kilitle" basar
 *   - Otomatik kilit: belirli süre hareketsizlikte kilitlenir (5 dk default)
 *   - Kilitliyken tüm uygulama erişilemez (LockScreen overlay)
 *   - Açmak için: oturum sahibinin şifresi gerekli (yeni token üretmez)
 *
 * Idle logout'tan farkı:
 *   - Idle logout: token siler, yeniden login gerekir (uzun süreli yoklukta)
 *   - Lock: oturum devam eder, sadece şifre engeli (kısa süreli paylaşım)
 *
 * State `gastro_locked` localStorage'da → tarayıcı kapanıp açılırsa kilit korunur.
 */

const LOCK_KEY = 'gastro_locked'
const AUTO_LOCK_MINUTES = 5

export function useLock() {
  const { isAuthenticated } = useAuthStore()
  const [locked, setLockedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(LOCK_KEY) === 'true'
  })

  const lock = useCallback(() => {
    setLockedState(true)
    try { localStorage.setItem(LOCK_KEY, 'true') } catch { /* private mode */ }
  }, [])

  const unlock = useCallback(() => {
    setLockedState(false)
    try { localStorage.removeItem(LOCK_KEY) } catch { /* private mode */ }
  }, [])

  // Otomatik kilit — 5 dk hareketsiz kalınca
  useEffect(() => {
    if (!isAuthenticated || locked) return

    const idleMs = AUTO_LOCK_MINUTES * 60 * 1000
    let timer: ReturnType<typeof setTimeout>

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(lock, idleMs)
    }

    const events: Array<keyof DocumentEventMap> = [
      'mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click',
    ]
    events.forEach(e => document.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(timer)
      events.forEach(e => document.removeEventListener(e, reset))
    }
  }, [isAuthenticated, locked, lock])

  // Auth değişikliği: logout olunca kilit de temizlensin
  useEffect(() => {
    if (!isAuthenticated && locked) unlock()
  }, [isAuthenticated, locked, unlock])

  return { locked, lock, unlock }
}
