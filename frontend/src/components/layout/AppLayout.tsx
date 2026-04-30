import React, { useState, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/hooks/useSocket'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useIdleLogout } from '@/hooks/useIdleLogout'
import { useSettingsStore } from '@/store/settingsStore'
import { setActiveCurrency } from '@/utils/format'

export const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const { status } = useSocket()
  const { queue } = useOfflineQueue()

  // 30 dakika hareketsizlikte otomatik çıkış (5 dk önce uyarı)
  useIdleLogout(30, 5)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
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

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] font-body relative">
      {/* Desktop sidebar — md ve üzeri */}
      <div className="hidden md:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          restaurantName={restaurantName}
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
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          connectionStatus={status}
          queueCount={queue.length}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-auto bg-[var(--color-bg)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
