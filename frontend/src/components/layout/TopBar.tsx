import React, { useState, useEffect, useRef } from 'react'
import { Search, Bell, Wifi, WifiOff, TrendingUp, X, Check, CheckCheck, Menu, Sun, Moon, Volume2, VolumeX } from 'lucide-react'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import { useSound } from '@/hooks/useSound'
import { cn, formatCurrency, formatRelative, getInitials } from '@/utils/format'
import { useAuthStore } from '@/store/authStore'
import { CONFIG } from '@/config'
import { useNotificationStore } from '@/store/notificationStore'
import { reportsApi } from '@/api/reports'
import type { ConnectionStatus } from '@/hooks/useSocket'

interface TopBarProps {
  connectionStatus: ConnectionStatus
  queueCount?: number
  onMenuClick?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  connectionStatus,
  queueCount = 0,
  onMenuClick,
}) => {
  const { user } = useAuthStore()
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore()
  const { prefs, effectiveTheme, setTheme, toggleSound } = useUserPreferences()
  const { play: playSound } = useSound()
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

  // Günlük ciro widget — sadece müdür/kasiyer/sahibi (garson görmez)
  const canSeeCiro = user && (user.role === 'admin' || user.role === 'manager' || user.role === 'cashier')

  useEffect(() => {
    if (!canSeeCiro) return
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
  }, [canSeeCiro])

  const statusConfig = {
    connected: { icon: <Wifi size={14} />, color: 'text-green-400', label: 'Bağlı' },
    disconnected: { icon: <WifiOff size={14} />, color: 'text-red-400', label: 'Bağlantı Yok' },
    connecting: { icon: <Wifi size={14} />, color: 'text-amber-400 animate-pulse', label: 'Bağlanıyor' },
    error: { icon: <WifiOff size={14} />, color: 'text-red-400', label: 'Hata' },
  }

  const { icon: statusIcon, color: statusColor, label: statusLabel } = statusConfig[connectionStatus]

  return (
    <header className="h-14 md:h-16 flex items-center px-2 md:px-4 gap-2 md:gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] relative z-20">
      {/* Hamburger menu — sadece mobil */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          aria-label="Menüyü aç"
          className="md:hidden p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors flex-shrink-0"
        >
          <Menu size={20} />
        </button>
      )}

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
          <div className="flex items-center gap-2 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 w-[min(16rem,calc(100vw-6rem))] animate-slide-in">
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

      {/* Sesli bildirim toggle — tek tık aç/kapat. Şift+tık test sesi çalar. */}
      <button
        onClick={(e) => {
          if (e.shiftKey) {
            // Shift+click: ses test (kullanıcı sesi duyabilsin)
            playSound('notification')
          } else {
            toggleSound()
            // Aç-kapa sırasında test ses (sadece açıyorsa)
            if (!prefs.soundEnabled) setTimeout(() => playSound('success'), 100)
          }
        }}
        title={prefs.soundEnabled ? 'Sesi kapat (Shift+tık: test)' : 'Sesi aç'}
        aria-label={prefs.soundEnabled ? 'Sesi kapat' : 'Sesi aç'}
        className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors hidden sm:block"
      >
        {prefs.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>

      {/* Tema toggle — dark/light/system döngüsü */}
      <button
        onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
        title={effectiveTheme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
        aria-label="Tema değiştir"
        className="p-2 rounded-xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors"
      >
        {effectiveTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

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
          <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-[20rem] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-card-hover z-50 animate-slide-up">
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

      {/* User avatar — Base64 data öncelikli, legacy URL fallback */}
      <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]">
        {user?.avatarData ? (
          <img
            src={user.avatarData}
            alt={user.fullName}
            className="w-8 h-8 rounded-xl object-cover border border-[var(--color-accent)]/30"
          />
        ) : user?.avatarUrl ? (
          <img
            src={`${CONFIG.API_BASE}${user.avatarUrl}`}
            alt={user.fullName}
            className="w-8 h-8 rounded-xl object-cover border border-[var(--color-accent)]/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)]/20 border border-[var(--color-accent)]/30 flex items-center justify-center">
            <span className="text-[var(--color-accent)] font-display font-bold text-xs">
              {user ? getInitials(user.fullName) : 'U'}
            </span>
          </div>
        )}
        <div className="hidden sm:block">
          <p className="text-xs font-semibold text-[var(--color-text)] font-body leading-tight max-w-[100px] truncate">
            {user?.fullName}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] font-body capitalize leading-tight">
            {user?.role === 'admin' ? 'Sahibi' :
             user?.role === 'manager' ? 'Müdür' :
             user?.role === 'cashier' ? 'Kasiyer' :
             user?.role === 'waiter' ? 'Garson' : 'Kullanıcı'}
          </p>
        </div>
      </div>
    </header>
  )
}
