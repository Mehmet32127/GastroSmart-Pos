import React, { useEffect, useState, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, LogOut, ShieldCheck, Building2, Copy, Check, Power, AlertTriangle } from 'lucide-react'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge, Card, Spinner, EmptyState } from '@/components/ui/common'
import { adminApi, type Tenant, type CreateTenantResponse } from '@/api/admin'
import { useAdminAuthStore } from '@/store/adminAuthStore'
import toast from 'react-hot-toast'

export const AdminDashboardPage: React.FC = () => {
  const { isAuthenticated, email, logout } = useAdminAuthStore()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState<CreateTenantResponse | null>(null)
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState<Tenant | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.listTenants()
      setTenants(res.data.data || [])
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Tenant listesi alınamadı')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) load()
  }, [isAuthenticated, load])

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }

  const handleToggleActive = async (tenant: Tenant) => {
    setTogglingSlug(tenant.slug)
    try {
      if (tenant.active) {
        await adminApi.deleteTenant(tenant.slug)
        toast.success(`${tenant.name} pasifleştirildi`)
      } else {
        await adminApi.updateTenant(tenant.slug, { active: true })
        toast.success(`${tenant.name} aktifleştirildi`)
      }
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'İşlem başarısız')
    } finally {
      setTogglingSlug(null)
      setConfirmDeactivate(null)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/15 flex items-center justify-center">
              <ShieldCheck size={18} className="text-[var(--color-accent)]" />
            </div>
            <div>
              <h1 className="text-base font-bold font-display text-[var(--color-text)]">Süper Yönetici Paneli</h1>
              <p className="text-xs text-[var(--color-text-muted)] font-body">{email}</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={<LogOut size={14} />} onClick={logout}>
            Çıkış
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text)]">Restoranlar</h2>
            <p className="text-xs text-[var(--color-text-muted)] font-body">{tenants.length} restoran kayıtlı</p>
          </div>
          <Button icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            Yeni Restoran
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} />}
            title="Henüz restoran yok"
            description="İlk restoranı eklemek için üstteki butona tıkla"
            action={<Button size="sm" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>Yeni Restoran</Button>}
          />
        ) : (
          <div className="grid gap-3">
            {tenants.map((t) => (
              <Card key={t.slug}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-[var(--color-text)] font-body">{t.name}</p>
                      <span className="font-mono text-xs text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-md">
                        /{t.slug}
                      </span>
                      <Badge variant={t.active ? 'success' : 'muted'} dot>
                        {t.active ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] font-body flex-wrap">
                      <span>DB: <strong className="font-mono">{t.dbName}</strong></span>
                      {t.contactEmail && <span>· {t.contactEmail}</span>}
                      <span>· {new Date(t.createdAt).toLocaleDateString('tr-TR')}</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Power size={14} />}
                    loading={togglingSlug === t.slug}
                    onClick={() => t.active ? setConfirmDeactivate(t) : handleToggleActive(t)}
                  >
                    {t.active ? 'Pasifleştir' : 'Aktifleştir'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateTenantModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(c) => {
          setCreateOpen(false)
          setCreated(c)
          load()
        }}
      />

      <CreatedTenantInfoModal
        info={created}
        onClose={() => setCreated(null)}
      />

      <ConfirmDialog
        isOpen={!!confirmDeactivate}
        title="Restoranı pasifleştir"
        message={`${confirmDeactivate?.name} pasifleştirilecek. Veritabanı silinmeyecek, tekrar aktifleştirilebilir. Devam edilsin mi?`}
        confirmText="Pasifleştir"
        danger
        onConfirm={() => confirmDeactivate && handleToggleActive(confirmDeactivate)}
        onCancel={() => setConfirmDeactivate(null)}
      />
    </div>
  )
}

// ─── Yeni tenant ekleme modal'ı ──────────────────────────────────────────────
interface CreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (info: CreateTenantResponse) => void
}

const CreateTenantModal: React.FC<CreateModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [saving, setSaving] = useState(false)

  // Slug otomatik öneri: name'den türet (kullanıcı override edebilir)
  const handleNameChange = (v: string) => {
    setName(v)
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(v))
    }
  }

  const reset = () => {
    setSlug(''); setName(''); setAdminEmail(''); setContactEmail('')
  }

  const handleSubmit = async () => {
    if (!slug.trim() || !name.trim() || !adminEmail.trim()) {
      toast.error('Slug, ad ve admin e-posta gerekli')
      return
    }
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
      toast.error('Slug: küçük harf+rakam+tire, harfle başlamalı, 2-31 karakter')
      return
    }
    setSaving(true)
    try {
      const res = await adminApi.createTenant({
        slug:         slug.trim(),
        name:         name.trim(),
        adminEmail:   adminEmail.trim(),
        contactEmail: contactEmail.trim() || undefined,
      })
      toast.success('Restoran oluşturuldu')
      reset()
      onCreated(res.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Restoran oluşturulamadı')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!saving) { reset(); onClose() } }}
      title="Yeni Restoran"
      size="md"
      footer={<>
        <Button variant="secondary" onClick={() => { reset(); onClose() }} disabled={saving}>İptal</Button>
        <Button onClick={handleSubmit} loading={saving}>Oluştur</Button>
      </>}
    >
      <div className="space-y-4">
        <Input label="Restoran Adı *" value={name} onChange={handleNameChange} placeholder="Restoranın adı" />
        <Input
          label="Slug (URL'de kullanılır) *"
          value={slug}
          onChange={(v) => setSlug(v.toLowerCase())}
          placeholder="restoran-adi"
          hint="küçük harf, rakam ve tire içerebilir"
          mono
        />
        <Input
          label="Admin E-posta *"
          type="email"
          value={adminEmail}
          onChange={setAdminEmail}
          placeholder="yonetici@gmail.com"
          hint="Restoran sahibinin giriş e-postası — geçici şifre ile birlikte verilir"
        />
        <Input
          label="İletişim E-posta (opsiyonel)"
          type="email"
          value={contactEmail}
          onChange={setContactEmail}
          placeholder="iletisim@gmail.com"
        />
      </div>
    </Modal>
  )
}

// ─── Oluşturulan tenant'ın geçici şifresini gösteren modal ───────────────────
const CreatedTenantInfoModal: React.FC<{ info: CreateTenantResponse | null; onClose: () => void }> = ({ info, onClose }) => {
  const [copied, setCopied] = useState(false)
  if (!info) return null

  const handleCopy = async () => {
    if (!info.adminTempPassword) return
    try {
      await navigator.clipboard.writeText(info.adminTempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { toast.error('Kopyalanamadı') }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Restoran oluşturuldu"
      size="md"
      footer={<Button onClick={onClose}>Tamam</Button>}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-400 font-body">
            Geçici şifre <strong>sadece bu pencerede</strong> gösterilir. Pencereyi kapatınca tekrar göremezsin — şimdi kopyala ve restoran sahibine ilet.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-body text-[var(--color-text-muted)]">Restoran:</p>
          <p className="text-base font-semibold font-body text-[var(--color-text)]">{info.tenant.name}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-body text-[var(--color-text-muted)]">Giriş bilgileri:</p>
          <div className="bg-[var(--color-surface2)] rounded-xl p-3 space-y-2 font-mono text-sm">
            <div><span className="text-[var(--color-text-muted)]">Kullanıcı adı:</span> <strong className="text-[var(--color-text)]">{info.adminUsername}</strong></div>
            {info.adminTempPassword && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-text-muted)]">Şifre:</span>
                <strong className="text-[var(--color-accent)] tracking-wider select-all">{info.adminTempPassword}</strong>
                <button onClick={handleCopy} className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-accent)]">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] font-body">
          Restoran sahibine bu bilgileri (mümkünse güvenli bir kanaldan — WhatsApp gizli, e-posta vb.) ilet.
          İlk girişten sonra şifreyi değiştirmesini öner.
        </p>
      </div>
    </Modal>
  )
}

// ─── Mini Input component (admin sayfaları için sade) ────────────────────────
interface InputProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  hint?: string
  mono?: boolean
}

const Input: React.FC<InputProps> = ({ label, value, onChange, placeholder, type = 'text', hint, mono }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm ${mono ? 'font-mono' : 'font-body'} text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50`}
    />
    {hint && <p className="text-[10px] text-[var(--color-text-muted)] font-body">{hint}</p>}
  </div>
)

// ─── Slug helper ─────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 31)
}
