import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Layout
import { AppLayout } from '@/components/layout/AppLayout'

// Pages
import { LoginPage }            from '@/pages/LoginPage'
import { ForgotPasswordPage }   from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage }    from '@/pages/ResetPasswordPage'
import { AdminLoginPage }       from '@/pages/admin/AdminLoginPage'
import { AdminDashboardPage }   from '@/pages/admin/AdminDashboardPage'
import { TablesPage }       from '@/pages/TablesPage'
import { OrdersPage }       from '@/pages/OrdersPage'
import { ReservationsPage } from '@/pages/ReservationsPage'
import { HistoryPage }      from '@/pages/HistoryPage'
import { ReportsPage }      from '@/pages/ReportsPage'
import { MenuPage }         from '@/pages/MenuPage'
import { UsersPage }        from '@/pages/UsersPage'
import { ThemePage }        from '@/pages/ThemePage'
import { SettingsPage }     from '@/pages/SettingsPage'

// Stores / hooks
import { useAuthStore }   from '@/store/authStore'
import { useThemeStore }  from '@/store/themeStore'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { CONFIG }         from '@/config'

// ─── Role Guard ──────────────────────────────────────────────────────────────
const RoleGuard: React.FC<{ roles: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { user } = useAuthStore()
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

// ─── App ─────────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const { applyTheme } = useThemeStore()

  // Kullanıcı tema tercihi (aydınlık/karanlık) — login sayfası dahil her yerde aktif.
  // useUserPreferences `data-theme` HTML attribute'unu otomatik set eder, CSS
  // variables buna göre değişir.
  useUserPreferences()

  // Apply theme on first render
  useEffect(() => {
    applyTheme()
  }, [applyTheme])

  // Backend wake-up — Render free tier 15 dk inaktif kalınca uyur, ilk istekte
  // 30-60 sn'de uyanır. App boot'tan socket bağlantısına kadar arka planda
  // ping atarak uyanmasını sağlıyoruz. Uyanana kadar 5 sn aralıkla denenir
  // (en fazla 24 deneme = 2 dakika).
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let attempts = 0
    const MAX_ATTEMPTS = 24

    const ping = async () => {
      if (cancelled || attempts >= MAX_ATTEMPTS) return
      attempts += 1
      try {
        const res = await fetch(`${CONFIG.API_BASE}/api/health`, {
          method: 'GET',
          mode:   'cors',
          cache:  'no-store',
        })
        if (res.ok) return  // Uyandı, devam etme
      } catch {
        // Bağlantı yok — Render hâlâ uyanıyor
      }
      if (!cancelled && attempts < MAX_ATTEMPTS) {
        timer = setTimeout(ping, 5000)
      }
    }

    ping()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: CONFIG.TOAST_DURATION,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            fontSize: '13px',
            fontFamily: 'DM Sans, sans-serif',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          },
          success: {
            iconTheme: {
              primary: 'var(--color-accent)',
              secondary: 'var(--color-accent-text)',
            },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />

      <Routes>
        {/* Public — legacy (slug'sız) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Multi-tenant: tenant slug'lı login + reset URL'leri */}
        <Route path="/r/:slug/login" element={<LoginPage />} />
        <Route path="/r/:slug/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/r/:slug/reset-password/:token" element={<ResetPasswordPage />} />

        {/* Süper-admin (sistem sahibi) — tenant kullanıcılarından bağımsız */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

        {/* Protected — wrapped in AppLayout */}
        <Route element={<AppLayout />}>
          <Route index element={<TablesPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/reservations" element={<ReservationsPage />} />
          <Route path="/history" element={<HistoryPage />} />

          {/* Raporlar: admin + müdür + kasiyer (garson hariç) */}
          <Route path="/reports" element={
            <RoleGuard roles={['admin', 'manager', 'cashier']}>
              <ReportsPage />
            </RoleGuard>
          } />

          {/* Manager+ */}
          <Route path="/menu" element={
            <RoleGuard roles={['admin', 'manager']}>
              <MenuPage />
            </RoleGuard>
          } />

          {/* Admin only */}
          <Route path="/users" element={
            <RoleGuard roles={['admin']}>
              <UsersPage />
            </RoleGuard>
          } />

          <Route path="/theme" element={
            <RoleGuard roles={['admin', 'manager']}>
              <ThemePage />
            </RoleGuard>
          } />

          <Route path="/settings" element={
            <RoleGuard roles={['admin', 'manager']}>
              <SettingsPage />
            </RoleGuard>
          } />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
