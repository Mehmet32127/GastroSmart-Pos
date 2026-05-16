import React, { useState, useEffect, useRef } from 'react'
import { Save, Building2, Phone, FileText, Globe, Receipt, Printer, Download, UserCircle, Camera, Trash2, Sun, Moon, Monitor, Volume2, VolumeX, Keyboard } from 'lucide-react'
import { Card } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { settingsApi } from '@/api/settings'
import { authApi } from '@/api/auth'
import { setActiveCurrency, getInitials } from '@/utils/format'
import { useAuthStore } from '@/store/authStore'
import { useAuth } from '@/hooks/useAuth'
import { useUserPreferences } from '@/hooks/useUserPreferences'
import client from '@/api/client'
import { CONFIG } from '@/config'
import toast from 'react-hot-toast'

interface SettingsData {
  restaurantName: string
  address: string
  phone: string
  taxNo: string
  receiptFooter: string
  currency: string
  timezone: string
}

const CURRENCIES = ['TRY', 'USD', 'EUR', 'GBP']
const TIMEZONES  = ['Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'America/New_York']

export const SettingsPage: React.FC = () => {
  const [data, setData] = useState<SettingsData>({
    restaurantName: '',
    address:        '',
    phone:          '',
    taxNo:          '',
    receiptFooter:  'Teşekkürler!',
    currency:       'TRY',
    timezone:       'Europe/Istanbul',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  // Yazıcı kağıt boyutu — DB'de saklanır (tüm cihazlarda tutarlı), ayrıca
  // localStorage'a da yazılır (offline cihazda hızlı okuma için)
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(() =>
    (localStorage.getItem('gastro_paper_width') as '58mm' | '80mm') ?? '80mm'
  )
  const [downloading, setDownloading] = useState(false)
  const isAdmin = useAuthStore((s) => s.hasRole(['admin']))
  const user = useAuthStore((s) => s.user)
  const { logout } = useAuth()

  // ── Hesabım — kullanıcı kendi profilini düzenler ──────────────────────────
  const [profile, setProfile] = useState({
    fullName: user?.fullName ?? '',
    username: user?.username ?? '',
    email:    user?.email    ?? '',
    phone:    user?.phone    ?? '',
  })
  // profileSaving + handleSaveProfile kaldırıldı — artık unified handleSaveAll kullanılıyor.

  useEffect(() => {
    if (user) {
      setProfile({
        fullName: user.fullName,
        username: user.username,
        email:    user.email ?? '',
        phone:    user.phone ?? '',
      })
    }
  }, [user])

  const handleDownloadBackup = async () => {
    setDownloading(true)
    try {
      const res = await client.get('/settings/backup', { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gastrosmart-yedek-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Yedek indirildi')
    } catch {
      toast.error('Yedek indirilemedi')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    settingsApi.get()
      .then(({ data: res }) => {
        if (res.data) {
          const s = res.data
          setData({
            restaurantName: s.restaurantName ?? '',
            address:        s.address ?? '',
            phone:          s.phone ?? '',
            taxNo:          s.taxNo ?? '',
            receiptFooter:  s.receiptFooter ?? 'Teşekkürler!',
            currency:       s.currency ?? 'TRY',
            timezone:       s.timezone ?? 'Europe/Istanbul',
          })
          // DB'deki paperWidth localStorage'dan ÜSTÜN — yeni cihazda da tutarlı
          if (s.paperWidth === '58mm' || s.paperWidth === '80mm') {
            setPaperWidth(s.paperWidth)
            localStorage.setItem('gastro_paper_width', s.paperWidth)
          }
        }
      })
      .catch(() => toast.error('Ayarlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  // Unified Save — hem profil hem restoran ayarları tek seferde kaydedilir.
  // Sayfanın altında tek büyük "Tüm Değişiklikleri Kaydet" butonuna bağlı.
  const handleSaveAll = async () => {
    if (!data.restaurantName.trim()) {
      toast.error('Restoran adı boş olamaz')
      return
    }
    if (!profile.fullName.trim() || !profile.username.trim()) {
      toast.error('Ad ve kullanıcı adı boş olamaz')
      return
    }

    setSaving(true)
    let profileUpdated = null as any
    let requireRelogin = false

    try {
      // 1) Profil güncelle (öncelikli — username değişimi token revoke eder)
      const profileRes = await authApi.updateProfile({
        username: profile.username.trim(),
        fullName: profile.fullName.trim(),
        email:    profile.email.trim() || undefined,
        phone:    profile.phone.trim() || undefined,
      })
      profileUpdated = profileRes.data.data
      requireRelogin = !!profileUpdated?.requireRelogin

      // 2) Restoran ayarları
      await settingsApi.update({
        restaurantName: data.restaurantName.trim(),
        address:        data.address.trim(),
        phone:          data.phone.trim(),
        taxNo:          data.taxNo.trim(),
        receiptFooter:  data.receiptFooter.trim(),
        currency:       data.currency,
        timezone:       data.timezone,
        paperWidth,
      })
      localStorage.setItem('gastro_paper_width', paperWidth)
      setActiveCurrency(data.currency)
      window.dispatchEvent(new CustomEvent('settings:updated'))

      if (profileUpdated && !requireRelogin) {
        useAuthStore.getState().setUser(profileUpdated)
      }

      toast.success(requireRelogin
        ? 'Kaydedildi — kullanıcı adı değişti, tekrar giriş yapın'
        : 'Tüm değişiklikler kaydedildi'
      )

      if (requireRelogin) setTimeout(() => logout(), 1500)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Kaydetme başarısız')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof SettingsData) => ({
    value: data[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setData(d => ({ ...d, [key]: e.target.value })),
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5 overflow-y-auto h-full">
      {/* Header — tek kaydet butonu sayfanın altında */}
      <div>
        <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Restoran Ayarları</h1>
        <p className="text-sm text-[var(--color-text-muted)] font-body">Genel bilgiler ve sistem ayarları</p>
      </div>

      {/* Hesabım — kullanıcının kendi profili */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-[var(--color-text)] flex items-center gap-2 mb-4">
          <UserCircle size={16} className="text-[var(--color-accent)]" /> Hesabım
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Ad Soyad *</label>
            <input
              value={profile.fullName}
              onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Kullanıcı Adı *</label>
            <input
              value={profile.username}
              onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
            />
            <p className="text-[10px] text-[var(--color-text-muted)]/70 font-body">Değiştirirsen tekrar giriş yapman gerekir</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">E-posta</label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              placeholder="ornek@gmail.com"
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Telefon</label>
            <input
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
              placeholder="0500 000 00 00"
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
            />
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)]/70 font-body mt-3">
          Şifreyi değiştirmek için "Şifre" butonu (yakında) veya "Şifremi unuttum" akışını kullan.
        </p>
      </Card>

      {/* Profil Fotoğrafı + Kişisel Tercihler */}
      <ProfileSettingsCard />

      {/* Restoran Logosu — sadece admin değiştirebilir */}
      <RestaurantLogoCard />

      {/* Restaurant Info */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4 flex items-center gap-2">
          <Building2 size={16} className="text-[var(--color-accent)]" /> Restoran Bilgileri
        </h2>
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Restoran Adı *</label>
            <input
              {...field('restaurantName')}
              placeholder="Restoranım"
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
            />
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Adres</label>
            <input
              {...field('address')}
              placeholder="Atatürk Cad. No:1, İstanbul"
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
            />
          </div>

          {/* Phone + Tax No */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body flex items-center gap-1">
                <Phone size={11} /> Telefon
              </label>
              <input
                {...field('phone')}
                placeholder="0212 000 00 00"
                className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body flex items-center gap-1">
                <FileText size={11} /> Vergi No
              </label>
              <input
                {...field('taxNo')}
                placeholder="1234567890"
                className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Receipt Settings */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4 flex items-center gap-2">
          <Receipt size={16} className="text-[var(--color-accent)]" /> Fiş Ayarları
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Fiş Alt Notu</label>
            <textarea
              value={data.receiptFooter}
              onChange={e => setData(d => ({ ...d, receiptFooter: e.target.value }))}
              rows={2}
              placeholder="Teşekkürler!"
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors resize-none"
            />
          </div>
        </div>
      </Card>

      {/* System Settings */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4 flex items-center gap-2">
          <Globe size={16} className="text-[var(--color-accent)]" /> Sistem
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Para Birimi</label>
            <select
              {...field('currency')}
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
            >
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Saat Dilimi</label>
            <select
              {...field('timezone')}
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
            >
              {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Yazıcı Ayarları */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4 flex items-center gap-2">
          <Printer size={16} className="text-[var(--color-accent)]" /> Termal Yazıcı
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Kağıt Boyutu</label>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as const).map(w => (
                <button key={w} onClick={() => setPaperWidth(w)}
                  className={`flex-1 py-2 rounded-xl text-sm font-body border transition-all ${
                    paperWidth === w
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                      : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]'
                  }`}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)] font-body space-y-1">
            <p className="font-semibold text-[var(--color-text)]">Termal Yazıcı Kullanımı</p>
            <p>1. Fiş ekranında <strong>Yazdır</strong> butonuna tıklayın</p>
            <p>2. Yazıcı listesinden termal yazıcınızı seçin</p>
            <p>3. Kağıt boyutunu <strong>{paperWidth}</strong> olarak ayarlayın</p>
            <p>4. Kenar boşluklarını <strong>Yok</strong> yapın</p>
          </div>
        </div>
      </Card>

      {/* Yedekleme — sadece admin */}
      {isAdmin && (
        <Card>
          <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4 flex items-center gap-2">
            <Download size={16} className="text-[var(--color-accent)]" /> Yedekleme
          </h2>
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-muted)] font-body">
              Tüm restoran verilerini (menü, masalar, siparişler, ayarlar) tek bir JSON dosyası olarak indirin.
              Şifreler dahil edilmez. Önemli değişikliklerden önce yedek almanız önerilir.
            </p>
            <Button
              variant="secondary"
              icon={<Download size={14} />}
              loading={downloading}
              onClick={handleDownloadBackup}
            >
              Yedeği İndir
            </Button>
          </div>
        </Card>
      )}

      {/* Tek büyük Kaydet butonu — sayfa altında.
          Profil + restoran ayarları tek seferde kaydedilir (handleSaveAll). */}
      <div className="pt-4 pb-8 sticky bottom-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/95 to-transparent">
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-text)] font-display font-bold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-card-hover"
        >
          {saving ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-current border-t-transparent rounded-full" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <Save size={20} />
              Tüm Değişiklikleri Kaydet
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Profil Fotoğrafı + Kişisel Tercihler Kartı ─────────────────────────────
// Kullanıcı kendi avatarını yükler ve tema/ses/kısayol tercihlerini ayarlar.
const ProfileSettingsCard: React.FC = () => {
  const { user, setUser } = useAuthStore()
  const { prefs, setTheme, toggleSound, toggleShortcuts } = useUserPreferences()
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Base64 data URL öncelikli, eski URL fallback (legacy avatar'lar için)
  const avatarSrc = user?.avatarData
    ? user.avatarData
    : (user?.avatarUrl ? `${CONFIG.API_BASE}${user.avatarUrl}` : null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Backend limit ile eşleşmeli (500 KB) — büyükse hiç yükleme deneme
    if (file.size > 500 * 1024) {
      toast.error(`Dosya çok büyük: ${Math.round(file.size / 1024)} KB. Maksimum 500 KB.`)
      return
    }

    setUploading(true)
    try {
      const { data } = await authApi.uploadAvatar(file)
      if (user && data.data) {
        // Yeni Base64 datayı yerleştir, eski legacy URL'yi temizle
        setUser({ ...user, avatarData: data.data.avatarData, avatarUrl: null })
      }
      toast.success('Profil fotoğrafı güncellendi')
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Yüklenemedi'
      toast.error(msg)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    try {
      await authApi.deleteAvatar()
      if (user) setUser({ ...user, avatarData: null, avatarUrl: null })
      toast.success('Profil fotoğrafı kaldırıldı')
    } catch {
      toast.error('Silinemedi')
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold font-display text-[var(--color-text)] flex items-center gap-2 mb-4">
        <UserCircle size={16} className="text-[var(--color-accent)]" /> Profil & Kişisel Tercihler
      </h2>

      {/* Avatar */}
      <div className="flex items-center gap-4 pb-4 mb-4 border-b border-[var(--color-border)]">
        <div className="relative">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt="Profil"
              className="w-20 h-20 rounded-2xl object-cover border-2 border-[var(--color-accent)]/30"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent)]/20 border-2 border-[var(--color-accent)]/30 flex items-center justify-center">
              <span className="text-[var(--color-accent)] font-display font-bold text-2xl">
                {user ? getInitials(user.fullName) : 'U'}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs text-[var(--color-text-muted)] font-body mb-2">
            Profil fotoğrafı — JPG/PNG/WebP, max 2 MB
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-xs font-semibold font-body hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Camera size={12} />
              {uploading ? 'Yükleniyor...' : (avatarSrc ? 'Değiştir' : 'Yükle')}
            </button>
            {avatarSrc && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold font-body hover:bg-red-500/20 flex items-center gap-1.5"
              >
                <Trash2 size={12} /> Kaldır
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tema */}
      <div className="pb-4 mb-4 border-b border-[var(--color-border)]">
        <label className="text-xs font-medium text-[var(--color-text-muted)] font-body block mb-2">Tema</label>
        <div className="flex gap-2">
          {([
            { value: 'system', label: 'Sistem', icon: <Monitor size={14} /> },
            { value: 'light',  label: 'Aydınlık', icon: <Sun size={14} /> },
            { value: 'dark',   label: 'Karanlık', icon: <Moon size={14} /> },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold font-body transition-colors ${
                prefs.theme === opt.value
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40'
                  : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ses + Kısayollar toggle */}
      <div className="space-y-2">
        <button
          onClick={toggleSound}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--color-surface2)] hover:bg-[var(--color-border)] transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-body text-[var(--color-text)]">
            {prefs.soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            Sesli Bildirimler
          </span>
          <span className={`w-10 h-5 rounded-full relative transition-colors ${prefs.soundEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prefs.soundEnabled ? 'left-5' : 'left-0.5'}`} />
          </span>
        </button>

        <button
          onClick={toggleShortcuts}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--color-surface2)] hover:bg-[var(--color-border)] transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-body text-[var(--color-text)]">
            <Keyboard size={14} />
            Klavye Kısayolları
          </span>
          <span className={`w-10 h-5 rounded-full relative transition-colors ${prefs.shortcutsEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${prefs.shortcutsEnabled ? 'left-5' : 'left-0.5'}`} />
          </span>
        </button>
        <p className="text-[10px] text-[var(--color-text-muted)]/70 font-body px-1">
          Ctrl + / ile kısayollar rehberini açabilirsin
        </p>
      </div>
    </Card>
  )
}

// ─── Restoran Logosu Kartı ──────────────────────────────────────────────────
// Sadece admin/manager. Base64 olarak DB'ye yazılır (Render restart'a dayanır).
const RestaurantLogoCard: React.FC = () => {
  const isAdminOrManager = useAuthStore((s) => s.hasRole(['admin', 'manager']))
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    settingsApi.get().then(({ data }) => {
      if (data.data?.logoUrl) setLogoUrl(data.data.logoUrl)
    }).catch(() => {})
  }, [])

  if (!isAdminOrManager) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) {
      toast.error(`Dosya çok büyük: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maksimum 1 MB.`)
      // Input'u sıfırla — aynı dosya tekrar seçilince onChange tekrar tetiklensin
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setUploading(true)
    try {
      const { data } = await settingsApi.uploadLogo(file)
      if (data.data?.url) setLogoUrl(data.data.url)
      toast.success('Restoran logosu güncellendi')
      window.dispatchEvent(new CustomEvent('settings:updated'))
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Yüklenemedi')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    try {
      await settingsApi.deleteLogo()
      setLogoUrl(null)
      toast.success('Logo kaldırıldı')
      window.dispatchEvent(new CustomEvent('settings:updated'))
    } catch {
      toast.error('Silinemedi')
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold font-display text-[var(--color-text)] flex items-center gap-2 mb-4">
        <Building2 size={16} className="text-[var(--color-accent)]" /> Restoran Logosu
      </h2>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-2xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Building2 size={32} className="text-[var(--color-text-muted)]/40" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs text-[var(--color-text-muted)] font-body mb-2">
            Sidebar ve fişlerde görünür. JPG/PNG/WebP, max 1 MB.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="px-3 py-1.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-xs font-semibold font-body hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? 'Yükleniyor...' : (logoUrl ? 'Değiştir' : 'Logo Yükle')}
            </button>
            {logoUrl && (
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-semibold font-body hover:bg-red-500/20"
              >
                Kaldır
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
