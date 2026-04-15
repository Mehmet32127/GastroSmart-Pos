import React, { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useAuthStore } from '@/store/authStore'
import { useSocket } from '@/hooks/useSocket'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import { settingsApi } from '@/api/settings'

export const AppLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore()
  const { status } = useSocket()
  const { queue } = useOfflineQueue()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [restaurantName, setRestaurantName] = useState('GastroSmart')
  const [logoUrl, setLogoUrl] = useState<string | undefined>()

  const fetchSettings = () => {
    settingsApi.get()
      .then(({ data }) => {
        if (data.data) {
          setRestaurantName(data.data.restaurantName)
          setLogoUrl(data.data.logoUrl)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    fetchSettings()
    window.addEventListener('settings:updated', fetchSettings)
    return () => window.removeEventListener('settings:updated', fetchSettings)
  }, [])

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] font-body relative">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          connectionStatus={status}
          queueCount={queue.length}
          restaurantName={restaurantName}
          logoUrl={logoUrl}
        />
        <main className="flex-1 overflow-auto bg-[var(--color-bg)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
