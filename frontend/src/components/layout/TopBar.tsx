import React, { useState, useEffect, useRef } from 'react'
import { Search, Bell, Wifi, WifiOff, TrendingUp, X, Check, CheckCheck } from 'lucide-react'
import { cn, formatCurrency, formatRelative, getInitials } from '@/utils/format'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { reportsApi } from '@/api/reports'
import type { ConnectionStatus } from '@/hooks/useSocket'

interface TopBarProps {
  connectionStatus: ConnectionStatus
  queueCount?: number
}

export const TopBar: React.FC<TopBarProps> = ({
  connectionStatus,
  queueCount = 0,
}) => {
  const { user } = useAuthStore()
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [dailyCiro, setDailyCiro] = useState<{ total: number; orderCount: number } | null>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    reportsApi.getDailyCiro()
      .then(({ data }) => {
        if (data.data) setDailyCiro(data.data)
      })
      .catch(() => {})

    const interval = setInterval(() => {
      reportsApi.getDailyCiro()
        .then(({ data }) => {
          if (data.data) setDailyCiro(data.data)
        })
        .catch(() => {})
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const statusConfig = {
    connected: { icon: <Wifi size={14} />, color: 'text-green-400', label: 'Bağlı' },
    disconnected: { icon: <WifiOff size={14} />, color: 'text-red-400', label: 'Bağlantı Yok' },
    connecting: { icon: <Wifi size={14} />, color: 'text-amber-400 animate-pulse', label: 'Bağlanıyor' },
    error: { icon: <WifiOff size={14} />, color: 'text-red-400', label: 'Hata' },
  }

  const { icon: statusIcon, color: statusColor, label: statusLabel } = statusConfig[connectionStatus]

  return (
    <header className="h-16 flex items-center px-4 gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] relative z-20">
      {/* Connection status */}
      <div className={cn('flex items-center gap-1.5 text-xs font-body flex-shrink-0', statusColor)}>
        {statusIcon}
        <span className="hidden sm:inline">{statusLabel}</span>
        {queueCount > 0 && (
          <span className="ml-1 text-amber-400 hidden sm:inline">• {queueCount} bekliyor</span>
        )}
      </div>

      {/* Daily ciro indicator */}
      {dailyCiro && (
        <div className="hidden md:flex items-center gap-2 ml-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20">
          <TrendingUp size={14} className="text-green-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-green-400 font-mono leading-tight">
              {formatCurrency(dailyCiro.total)}
            </p>
            <p className="text-[10px] text-green-400/60 font-body leading-tight">
              {dailyCiro.orderCount} sipariş
            </p>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Search */}
      <div className="relative">
        {searchOpen ? (
          <div className="flex items-center gap-2 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 w-64 animate-slide-in">
            <Search size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ara... (masa, sipariş)"
              className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none font-body"
            />
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }}>
              <X size={14} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors"
          >
            <Search size={18} />
          </button>
        )}
      </div>

      {/* Notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setNotifOpen(!notifOpen)}
          className="relative p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[var(--color-accent)] text-[var(--color-accent-text)] text-[9px] font-bold flex items-center justify-center animate-bounce-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification dropdown */}
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-card-hover z-50 animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-semibold text-[var(--color-text)] font-display">
                Bildirimler
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs text-[var(--color-accent)]">{unreadCount} yeni</span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors font-body"
                >
                  <CheckCheck size={12} />
                  Tümünü oku
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-sm text-[var(--color-text-muted)] font-body">
                  Bildirim yok
                </div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface2)]',
                      !n.read && 'bg-[var(--color-accent)]/5'
                    )}
                  >
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      n.type === 'success' && 'bg-green-400',
                      n.type === 'warning' && 'bg-amber-400',
                      n.type === 'error' && 'bg-red-400',
                      n.type === 'order' && 'bg-[var(--color-accent)]',
                      n.type === 'info' && 'bg-blue-400',
                      n.read && 'opacity-30'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold font-body truncate', n.read ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] font-body line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]/60 font-body mt-0.5">
                        {formatRelative(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <Check size={12} className="text-[var(--color-accent)] flex-shrink-0 mt-1" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]">
        <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 flex items-center justify-center">
          <span className="text-[var(--color-accent)] font-display font-bold text-xs">
            {user ? getInitials(user.fullName) : 'U'}
          </span>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-[var(--color-text)] font-body leading-tight max-w-[100px] truncate">
            {user?.fullName}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] font-body capitalize leading-tight">
            {user?.role === 'admin' ? 'Yönetici' :
             user?.role === 'manager' ? 'Müdür' :
             user?.role === 'waiter' ? 'Garson' : 'Kullanıcı'}
          </p>
        </div>
      </div>
    </header>
  )
}
