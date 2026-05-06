import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, Eye, EyeOff, CheckCircle, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { authPasswordApi } from '@/api/users'

const schema = z.object({
  newPassword: z.string()
    .min(8, 'En az 8 karakter')
    .regex(/[A-Z]/, 'En az bir büyük harf gerekli')
    .regex(/[0-9]/, 'En az bir rakam gerekli'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export const ResetPasswordPage: React.FC = () => {
  const { token, slug } = useParams<{ token: string; slug?: string }>()
  const loginPath = slug ? `/r/${slug}/login` : '/login'
  const forgotPath = slug ? `/r/${slug}/forgot-password` : '/forgot-password'
  const navigate = useNavigate()
  const [showPw, setShowPw]     = useState(false)
  const [done, setDone]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-8 max-w-sm text-center">
          <h1 className="text-xl font-bold text-[var(--color-text)] mb-2 font-display">Geçersiz Link</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body mb-4">Bu link geçersiz veya bozuk.</p>
          <Link to={forgotPath} className="text-[var(--color-accent)] font-semibold text-sm font-body">Yeni link iste</Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError(null)
    try {
      await authPasswordApi.resetPassword(token, data.newPassword)
      setDone(true)
      toast.success('Şifre güncellendi')
      setTimeout(() => navigate(loginPath), 2500)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      const msg = e?.response?.data?.error || 'Şifre sıfırlanamadı'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--color-accent)]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[var(--color-accent)]/3 blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-slide-up relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/60 items-center justify-center mb-4 shadow-glow-brand">
            {done
              ? <CheckCircle size={24} className="text-[var(--color-accent-text)]" />
              : <KeyRound size={24} className="text-[var(--color-accent-text)]" />}
          </div>
          <h1 className="text-2xl font-black font-display text-[var(--color-text)]">
            {done ? 'Başarılı' : 'Yeni Şifre Belirle'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body mt-2">
            {done ? 'Giriş sayfasına yönlendiriliyorsunuz...' : 'Hesabınız için yeni bir şifre oluşturun'}
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-card">
          {done ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-[var(--color-text-muted)] font-body">
                Şifreniz başarıyla güncellendi. Yeni şifreniz ile giriş yapabilirsiniz.
              </p>
              <Link
                to={loginPath}
                className="block text-center w-full py-3 rounded-xl text-sm font-semibold font-body bg-[var(--color-accent)] text-[var(--color-accent-text)]"
              >
                Giriş Yap
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-body">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">Yeni Şifre</label>
                <div className="relative flex items-center rounded-xl border border-[var(--color-border)]">
                  <div className="absolute left-3 text-[var(--color-text-muted)]"><Lock size={16} /></div>
                  <input
                    {...register('newPassword')}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full bg-[var(--color-surface2)] rounded-xl pl-10 pr-10 py-3 text-sm font-body text-[var(--color-text)] focus:outline-none"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-xs text-red-400 font-body">{errors.newPassword.message}</p>}
                <p className="text-[10px] text-[var(--color-text-muted)]/70 font-body">
                  En az 8 karakter, 1 büyük harf, 1 rakam içermeli
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">Şifre Tekrar</label>
                <div className="relative flex items-center rounded-xl border border-[var(--color-border)]">
                  <div className="absolute left-3 text-[var(--color-text-muted)]"><Lock size={16} /></div>
                  <input
                    {...register('confirmPassword')}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="w-full bg-[var(--color-surface2)] rounded-xl pl-10 pr-4 py-3 text-sm font-body text-[var(--color-text)] focus:outline-none"
                  />
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-400 font-body">{errors.confirmPassword.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold font-body bg-[var(--color-accent)] text-[var(--color-accent-text)] active:scale-98 transition disabled:opacity-60"
              >
                {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
