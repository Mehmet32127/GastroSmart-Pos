import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Lock, User, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'

const schema = z.object({
  username: z.string().min(1, 'Kullanıcı adı gerekli'),
  password: z.string().min(1, 'Şifre gerekli'),
})

type FormData = z.infer<typeof schema>

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth()
  const { isOnline } = useOfflineQueue()
  const [showPw, setShowPw]           = useState(false)
  const [focused, setFocused]         = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormData) => login(data)

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--color-accent)]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[var(--color-accent)]/3 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: 'linear-gradient(var(--color-text) 1px, transparent 1px), linear-gradient(90deg, var(--color-text) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="w-full max-w-sm animate-slide-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/60 items-center justify-center mb-4 shadow-glow-brand">
            <span className="text-[var(--color-accent-text)] font-display font-black text-2xl">G</span>
          </div>
          <h1 className="text-2xl font-black font-display text-[var(--color-text)] tracking-tight">
            GastroSmart
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body mt-1">
            Profesyonel Restoran POS Sistemi
          </p>
          <div className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-body border ${
            isOnline
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            {isOnline ? 'Sunucu bağlı' : 'Offline mod'}
          </div>
        </div>

        {/* Card */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">
                Kullanıcı Adı
              </label>
              <div className={`relative flex items-center transition-all duration-200 rounded-xl border ${
                focused === 'username'
                  ? 'border-[var(--color-accent)]/50 shadow-[0_0_0_3px_var(--color-accent)/10]'
                  : errors.username ? 'border-red-500/40' : 'border-[var(--color-border)]'
              }`}>
                <div className="absolute left-3 text-[var(--color-text-muted)]"><User size={16} /></div>
                <input
                  {...register('username')}
                  autoComplete="username"
                  placeholder="kullanici.adi"
                  onFocus={() => setFocused('username')}
                  onBlur={() => setFocused(null)}
                  className="w-full bg-[var(--color-surface2)] rounded-xl pl-10 pr-4 py-3 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none"
                />
              </div>
              {errors.username && <p className="text-xs text-red-400 font-body">{errors.username.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">
                Şifre
              </label>
              <div className={`relative flex items-center transition-all duration-200 rounded-xl border ${
                focused === 'password'
                  ? 'border-[var(--color-accent)]/50 shadow-[0_0_0_3px_var(--color-accent)/10]'
                  : errors.password ? 'border-red-500/40' : 'border-[var(--color-border)]'
              }`}>
                <div className="absolute left-3 text-[var(--color-text-muted)]"><Lock size={16} /></div>
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  className="w-full bg-[var(--color-surface2)] rounded-xl pl-10 pr-10 py-3 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400 font-body">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <button type="submit" disabled={isLoading}
              className="relative w-full py-3 rounded-xl text-sm font-semibold font-body overflow-hidden transition-all duration-200 active:scale-98 disabled:opacity-60 group"
              style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}>
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Giriş yapılıyor...
                  </>
                ) : 'Giriş Yap'}
              </span>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
            </button>
          </form>

          {/* Şifremi unuttum */}
          <div className="mt-4 text-center">
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors font-body underline-offset-2 hover:underline"
            >
              Şifremi unuttum
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)]/40 font-body mt-6">
          GastroSmart POS v1.0 · Yerel Ağ Modu
        </p>
      </div>
    </div>
  )
}
