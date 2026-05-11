import React, { useState, useRef, useEffect } from 'react'
import { Lock, Eye, EyeOff, LogOut } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/utils/format'
import toast from 'react-hot-toast'

/**
 * Lock Screen — paylaşımlı bilgisayar/tablet senaryosu için.
 *
 * Kullanım: AppLayout'ta `locked` true iken tüm UI'yı kapatan overlay olarak
 * render edilir. Kullanıcı kendi şifresini girer, doğrulanırsa unlock çağırılır.
 *
 * Logout butonu da var — başka kullanıcı kullanacaksa tamamen çıkış yapabilir.
 */
interface LockScreenProps {
  onUnlock: () => void
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const { user, clearAuth } = useAuthStore()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Açılır açılmaz input'a odakla
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Şifre gerekli')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await authApi.verifyPassword(password)
      setPassword('')
      onUnlock()
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.error
      if (status === 423) {
        setError(msg || 'Hesap geçici olarak kilitli')
      } else if (status === 401) {
        setError('Şifre hatalı')
      } else {
        setError('Doğrulanamadı')
      }
      setPassword('')
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = () => {
    clearAuth()
    // localStorage temizlenir, useLock effect'i locked=false yapar
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ekran kilidi"
      className="fixed inset-0 z-[100] bg-[var(--color-bg)]/95 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-card-hover p-6 space-y-5 animate-bounce-in">
        {/* Avatar + isim */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/20 border-2 border-[var(--color-accent)]/30 flex items-center justify-center mb-3">
            <span className="text-[var(--color-accent)] font-display font-bold text-xl">
              {user ? getInitials(user.fullName) : 'U'}
            </span>
          </div>
          <h2 className="text-lg font-bold font-display text-[var(--color-text)]">
            {user?.fullName || 'Kullanıcı'}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] font-body mt-0.5">
            {user?.username && <span>@{user.username}</span>}
          </p>
        </div>

        {/* Kilit ikonu + açıklama */}
        <div className="flex items-center justify-center gap-2 text-[var(--color-text-muted)]">
          <Lock size={14} />
          <span className="text-xs font-body">Ekran kilitlendi. Şifrenizi girin.</span>
        </div>

        {/* Şifre formu */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              placeholder="Şifre"
              autoComplete="current-password"
              disabled={submitting}
              className="w-full px-4 py-3 pr-12 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/50 font-body disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <div className="text-xs text-red-400 font-body text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="w-full py-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-sm font-bold font-display hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {submitting ? 'Doğrulanıyor...' : 'Kilidi Aç'}
          </button>
        </form>

        {/* Logout — başka kullanıcı kullanacaksa */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors font-body"
        >
          <LogOut size={12} />
          Farklı hesapla giriş yap
        </button>
      </div>
    </div>
  )
}
