import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

/**
 * Auto-logout: kullanıcı belirli süre hareketsiz kalırsa çıkış yapar.
 *
 * Davranış:
 *   - Mouse hareketi, klavye, dokunma → timer sıfırlanır
 *   - Uyarı süresinden sonra "X dakika sonra çıkış yapılacak" toast'u
 *   - Toplam süre dolduğunda otomatik logout
 *   - Tarayıcı sekmesi kapanırsa zaten next-load'da token expiry kontrol edilir
 *
 * @param idleMinutes Toplam hareketsizlik süresi (varsayılan 30 dk)
 * @param warnBeforeMinutes Çıkıştan kaç dakika önce uyarı (varsayılan 5 dk)
 */
export function useIdleLogout(idleMinutes = 30, warnBeforeMinutes = 5) {
  const { isAuthenticated, clearAuth } = useAuthStore()
  const [warningShown, setWarningShown] = useState(false)
  const lastActivityRef = useRef<number>(Date.now())
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningToastIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const idleMs = idleMinutes * 60 * 1000
    const warnAtMs = (idleMinutes - warnBeforeMinutes) * 60 * 1000

    const reset = () => {
      lastActivityRef.current = Date.now()
      if (warningShown) {
        setWarningShown(false)
        if (warningToastIdRef.current) {
          toast.dismiss(warningToastIdRef.current)
          warningToastIdRef.current = null
        }
      }
    }

    const events: Array<keyof DocumentEventMap> = [
      'mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click',
    ]
    events.forEach(e => document.addEventListener(e, reset, { passive: true }))

    // Her 30 saniyede bir kontrol et
    checkIntervalRef.current = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current

      if (idle >= idleMs) {
        // Çıkış zamanı
        clearAuth()
        toast.error('Hareketsizlik nedeniyle oturumunuz kapatıldı', { duration: 5000 })
        if (warningToastIdRef.current) {
          toast.dismiss(warningToastIdRef.current)
        }
      } else if (idle >= warnAtMs && !warningShown) {
        // Uyarı zamanı
        setWarningShown(true)
        const id = toast(`${warnBeforeMinutes} dakika sonra oturumunuz otomatik kapanacak. Devam etmek için ekrana dokunun.`, {
          duration: warnBeforeMinutes * 60 * 1000,
          icon: '⏰',
        })
        warningToastIdRef.current = id
      }
    }, 30 * 1000)

    return () => {
      events.forEach(e => document.removeEventListener(e, reset))
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
      if (warningToastIdRef.current) toast.dismiss(warningToastIdRef.current)
    }
  }, [isAuthenticated, idleMinutes, warnBeforeMinutes, clearAuth, warningShown])
}
