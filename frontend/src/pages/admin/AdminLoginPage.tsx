import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { ShieldCheck, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { adminApi } from '@/api/admin'
import { useAdminAuthStore } from '@/store/adminAuthStore'
import toast from 'react-hot-toast'

export const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, setSession } = useAdminAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('E-posta ve şifre gerekli')
      return
    }
    setLoading(true)
    try {
      const res = await adminApi.login(email.trim(), password)
      const { token, email: returnedEmail } = res.data.data
      setSession(token, returnedEmail)
      toast.success('Giriş başarılı')
      navigate('/admin/dashboard', { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Giriş başarısız'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center">
              <ShieldCheck size={24} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Süper Yönetici</h1>
              <p className="text-xs text-[var(--color-text-muted)] font-body">Sistem sahibi girişi</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@gmail.com"
                autoComplete="email"
                className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body flex items-center gap-1">
                <Lock size={11} /> Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
              />
            </div>

            <Button type="submit" loading={loading} fullWidth>
              Giriş Yap
            </Button>

            <p className="text-[10px] text-[var(--color-text-muted)] font-body text-center mt-3">
              Bu panel sadece sistem sahibi içindir. Restoran personeli için ana giriş ekranını kullanın.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
