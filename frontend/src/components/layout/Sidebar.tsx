import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutGrid, ShoppingBag, CalendarDays, Clock, BarChart3,
  UtensilsCrossed, Users, Palette, Settings, LogOut,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/utils/format'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
  badge?: number
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { path: '/',             label: 'Masalar',       icon: <LayoutGrid size={20} /> },
  { path: '/orders',       label: 'Siparişler',    icon: <ShoppingBag size={20} /> },
  { path: '/reservations', label: 'Rezervasyonlar',icon: <CalendarDays size={20} /> },
  { path: '/history',      label: 'Geçmiş',        icon: <Clock size={20} /> },
  { path: '/reports',      label: 'Raporlar',      icon: <BarChart3 size={20} />,      roles: ['admin', 'manager'] },

  { path: '/menu',         label: 'Menü & Stok',   icon: <UtensilsCrossed size={20} />,roles: ['admin', 'manager'] },
  { path: '/users',        label: 'Kullanıcılar',  icon: <Users size={20} />,           roles: ['admin'] },
  { path: '/theme',        label: 'Tema',          icon: <Palette size={20} />,         roles: ['admin', 'manager'] },
  { path: '/settings',    label: 'Ayarlar',       icon: <Settings size={20} />,        roles: ['admin', 'manager'] },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  pendingOrders?: number
  pendingReservations?: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed, onToggle, pendingOrders = 0, pendingReservations = 0,
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [logoutConfirm, setLogoutConfirm] = useState(false)

  const getNavBadge = (path: string) => {
    if (path === '/orders' && pendingOrders > 0) return pendingOrders
    if (path === '/reservations' && pendingReservations > 0) return pendingReservations
    return undefined
  }

  const canAccess = (item: NavItem) => {
    if (!item.roles) return true
    return user ? item.roles.includes(user.role) : false
  }

  return (
    <aside className={cn(
      'relative flex flex-col h-full',
      'bg-[var(--color-surface)] border-r border-[var(--color-border)]',
      'transition-all duration-300 ease-in-out select-none',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b border-[var(--color-border)]', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0 shadow-glow-brand">
          <span className="text-[var(--color-accent-text)] font-display font-bold text-sm">G</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-bold text-sm text-[var(--color-text)] truncate leading-tight">GastroSmart</p>
            <p className="text-[10px] text-[var(--color-text-muted)] font-body uppercase tracking-widest truncate">POS System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-thin">
        {NAV_ITEMS.map((item) => {
          if (!canAccess(item)) return null
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))
          const badge = getNavBadge(item.path)

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group w-full flex items-center rounded-xl transition-all duration-200 relative',
                'text-sm font-medium font-body',
                collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
                isActive
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-accent)] rounded-r-full" />
              )}
              <span className={cn('flex-shrink-0 transition-transform duration-200', isActive && 'scale-110')}>
                {item.icon}
              </span>
              {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
              {badge !== undefined && badge > 0 && (
                <span className={cn(
                  'flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center',
                  'bg-[var(--color-accent)] text-[var(--color-accent-text)]',
                  collapsed && 'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] text-[8px]'
                )}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-[var(--color-border)]">
        {!logoutConfirm ? (
          <button onClick={() => setLogoutConfirm(true)} title={collapsed ? 'Çıkış Yap' : undefined}
            className={cn(
              'w-full flex items-center rounded-xl transition-all duration-200',
              'text-sm font-medium font-body text-[var(--color-text-muted)]',
              'hover:bg-red-500/10 hover:text-red-400',
              collapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5'
            )}>
            <LogOut size={20} className="flex-shrink-0" />
            {!collapsed && <span>Çıkış Yap</span>}
          </button>
        ) : (
          <div className={cn('flex gap-1', collapsed ? 'flex-col' : 'flex-row')}>
            <button onClick={logout}
              className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors font-body">
              {collapsed ? '✓' : 'Evet'}
            </button>
            <button onClick={() => setLogoutConfirm(false)}
              className="flex-1 py-1.5 rounded-lg bg-[var(--color-surface2)] text-[var(--color-text-muted)] text-xs font-medium hover:bg-[var(--color-border)] transition-colors font-body">
              {collapsed ? '✕' : 'İptal'}
            </button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button onClick={onToggle}
        className={cn(
          'absolute -right-3 top-20 z-10',
          'w-6 h-6 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]',
          'flex items-center justify-center',
          'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          'hover:border-[var(--color-accent)]/30 transition-all duration-200 shadow-card'
        )}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
