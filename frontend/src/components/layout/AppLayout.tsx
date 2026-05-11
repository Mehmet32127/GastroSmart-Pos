import React, { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { LockScreen } from './LockScreen'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/hooks/useSocket'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useIdleLogout } from '@/hooks/useIdleLogout'
import { useLock } from '@/hooks/useLock'
import { useSettingsStore } from '@/store/settingsStore'
import { setActiveCurrency } from '@/utils/format'
import { authApi } from '@/api/auth'

export const AppLayout: React.FC = () => {
  const { isAuthenticated, clearAuth, setUser } = useAuthStore()
  const { status } = useSocket()
  const { queue } = useOfflineQueue()
  const [validating, setValidating] = useState(true)

  // Boot'ta token'ı backend'e doğrulat — localStorage'a güvenmiyoruz.
  // Token expire olmuş veya geçersizse interceptor zaten clearAuth atar,
  // burada da ek olarak /me çağrısı yapıp güncel user bilgisini çekiyoruz.
  useEffect(() => {
    if (!isAuthenticated) {
      setValidating(false)
      return
    }
    let cancelled = false
    authApi.me()
      .then(({ data }) => {
        if (cancelled) return
        if (data.data) setUser(data.data)
      })
      .catch(() => {
        if (cancelled) return
        // Token geçersiz/expired → logout ve login'e yönlendir
        clearAuth()
      })
      .finally(() => {
        if (!cancelled) setValidating(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 30 dakika hareketsizlikte otomatik çıkış (5 dk önce uyarı)
  useIdleLogout(30, 5)

  // 5 dakika hareketsizlikte ekran kilidi (logout değil — şifre ile açılır)
  const { locked, lock, unlock } = useLock()

  // Tablet (768-1023): sidebar default collapsed (icon-only) → içerik için daha çok yer
  // Desktop (>=1024): sidebar default expanded
  // Kullanıcı manuel ayarladıysa localStorage'da tut, sonraki açılışta uygula
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = localStorage.getItem('gastro_sidebar_collapsed')
    if (stored !== null) return stored === 'true'
    // İlk açılışta tablet ise collapsed
    return window.innerWidth < 1024
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  // Manual toggle'da localStorage'a kaydet — bir sonraki açılışta hatırlansın
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('gastro_sidebar_collapsed', String(next)) } catch { /* private mode */ }
      return next
    })
  }

  // Pencere boyutu değişimi: kullanıcı manuel set etmemişse ekrana göre uyarla
  useEffect(() => {
    const stored = localStorage.getItem('gastro_sidebar_collapsed')
    if (stored !== null) return  // kullanıcı seçimi yapmış, dokunma
    const handler = () => setSidebarCollapsed(window.innerWidth < 1024)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const location = useLocation()
  const { restaurantName, currency, load: loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
    const onUpdate = () => loadSettings()
    window.addEventListener('settings:updated', onUpdate)
    return () => window.removeEventListener('settings:updated', onUpdate)
  }, [loadSettings])

  // Para birimini global formatCurrency'e aktar
  useEffect(() => { setActiveCurrency(currency) }, [currency])

  // Sayfa değişince mobil drawer'ı kapat
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Boot validate edilirken kısa loading — token reddedilirse otomatik logout olur
  if (validating) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] font-body relative">
      {/* Desktop sidebar — md ve üzeri */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          restaurantName={restaurantName}
          onLock={lock}
        />
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar — drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          collapsed={false}
          onToggle={() => setMobileOpen(false)}
          restaurantName={restaurantName}
          onLock={() => { setMobileOpen(false); lock() }}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          connectionStatus={status}
          queueCount={queue.length}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto bg-[var(--color-bg)]">
          {/* Sayfa geçiş animasyonu — rota değiştiğinde fade+slide.
              "wait" mode: önce eski sayfa çıkar, sonra yeni gelir.
              Düşük performanslı cihazlarda da pürüzsüz (sadece opacity+transform). */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Lock screen overlay — paylaşımlı bilgisayar/tablet için */}
      {locked && <LockScreen onUnlock={unlock} />}
    </div>
  )
}
