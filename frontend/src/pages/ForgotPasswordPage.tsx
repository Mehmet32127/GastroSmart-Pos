import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authPasswordApi } from '@/api/users'

const schema = z.object({
  email: z.string().email('Geçerli bir email adresi girin'),
})

type FormData = z.infer<typeof schema>

export const ForgotPasswordPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading]     = useState(false)

  // Login sayfasına dönüş URL'i — slug varsa korur
  const loginPath = slug ? `/r/${slug}/login` : '/login'

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await authPasswordApi.forgotPassword(data.email, slug)
      setSubmitted(true)
    } catch {
      toast.error('Bir hata oluştu, tekrar deneyin')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[var(--color-accent)]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[var(--color-accent)]/3 blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-slide-up relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/60 items-center justify-center mb-4 shadow-glow-brand">
            {submitted
              ? <CheckCircle size={24} className="text-[var(--color-accent-text)]" />
              : <Mail size={24} className="text-[var(--color-accent-text)]" />}
          </div>
          <h1 className="text-2xl font-black font-display text-[var(--color-text)]">
            {submitted ? 'Email Gönderildi' : 'Şifremi Unuttum'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body mt-2">
            {submitted
              ? 'Kayıtlı email adresine sıfırlama linki gönderildi'
              : 'Email adresinize sıfırlama linki göndereceğiz'}
          </p>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-card">
          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-[var(--color-text-muted)] font-body leading-relaxed">
                Eğer bu email kayıtlıysa, gelen kutunuza şifre sıfırlama linki gönderdik.
                Linkin süresi <strong>60 dakika</strong>.
              </p>
              <p className="text-xs text-[var(--color-text-muted)]/70 font-body">
                Email'i göremiyorsanız spam/gereksiz klasörünü kontrol edin.
              </p>
              <Link
                to={loginPath}
                className="block text-center w-full py-3 rounded-xl text-sm font-semibold font-body bg-[var(--color-accent)] text-[var(--color-accent-text)] active:scale-98 transition"
              >
                Giriş Sayfasına Dön
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">
                  Email Adresi
                </label>
                <div className="relative flex items-center rounded-xl border border-[var(--color-border)]">
                  <div className="absolute left-3 text-[var(--color-text-muted)]"><Mail size={16} /></div>
                  <input
                    {...register('email')}
                    type="email"
                    autoComplete="email"
                    placeholder="ornek@restoran.com"
                    className="w-full bg-[var(--color-surface2)] rounded-xl pl-10 pr-4 py-3 text-sm font-body text-[var(--color-text)] focus:outline-none"
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400 font-body">{errors.email.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold font-body bg-[var(--color-accent)] text-[var(--color-accent-text)] active:scale-98 transition disabled:opacity-60"
              >
                {loading ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
              </button>

              <Link
                to={loginPath}
                className="flex items-center justify-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors font-body"
              >
                <ArrowLeft size={12} />
                Giriş ekranına dön
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
