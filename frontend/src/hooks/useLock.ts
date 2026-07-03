import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

/**
 * Lock screen state — paylaşımlı bilgisayar/tablet senaryosu için.
 *
 * Davranış:
 *   - Manuel kilit: kullanıcı sidebar'dan "Kilitle" basar (veya Ctrl+L)
 *   - Kilitliyken tüm uygulama erişilemez (LockScreen overlay)
 *   - Açmak için: oturum sahibinin şifresi gerekli (yeni token üretmez)
 *
 * Not: Otomatik idle-kilit ve idle-logout kaldırıldı — kilit yalnızca
 * kullanıcının açık isteğiyle devreye girer.
 *
 * State `gastro_locked` localStorage'da → tarayıcı kapanıp açılırsa kilit korunur.
 */

const LOCK_KEY = 'gastro_locked'

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

  // Auth değişikliği: logout olunca kilit de temizlensin
  useEffect(() => {
    if (!isAuthenticated && locked) unlock()
  }, [isAuthenticated, locked, unlock])

  return { locked, lock, unlock }
}
