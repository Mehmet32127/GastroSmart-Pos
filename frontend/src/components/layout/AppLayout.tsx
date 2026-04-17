import React, { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/hooks/useSocket'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { useSettingsStore } from '@/store/settingsStore'
import { setActiveCurrency } from '@/utils/format'

export const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const { status } = useSocket()
  const { queue } = useOfflineQueue()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { restaurantName, currency, load: loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
    const onUpdate = () => loadSettings()
    window.addEventListener('settings:updated', onUpdate)
    return () => window.removeEventListener('settings:updated', onUpdate)
  }, [loadSettings])

  // Para birimini global formatCurrency'e aktar
  useEffect(() => { setActiveCurrency(currency) }, [currency])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] font-body relative">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        restaurantName={restaurantName}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          connectionStatus={status}
          queueCount={queue.length}
        />
        <main className="flex-1 overflow-auto bg-[var(--color-bg)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
