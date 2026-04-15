import React, { useState, useEffect, useRef } from 'react'
import { Save, Upload, X, Building2, Phone, FileText, Globe, Receipt, Printer } from 'lucide-react'
import { Card } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { settingsApi } from '@/api/settings'
import { CONFIG } from '@/config'
import toast from 'react-hot-toast'

interface SettingsData {
  restaurantName: string
  logoUrl?: string
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
  const [data, setData]         = useState<SettingsData>({
    restaurantName: '',
    logoUrl:        undefined,
    address:        '',
    phone:          '',
    taxNo:          '',
    receiptFooter:  'Teşekkürler!',
    currency:       'TRY',
    timezone:       'Europe/Istanbul',
  })
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | undefined>()
  const [logoFile, setLogoFile]       = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Yazıcı ayarları — localStorage'da tutulur (sunucu gerektirmez)
  const [printerName, setPrinterName] = useState(() => localStorage.getItem('gastro_printer_name') ?? '')
  const [paperWidth, setPaperWidth]   = useState<'58mm' | '80mm'>(() =>
    (localStorage.getItem('gastro_paper_width') as '58mm' | '80mm') ?? '80mm'
  )
  const [sysPrinters, setSysPrinters] = useState<{ name: string; isDefault: boolean }[]>([])
  const isElectron = !!(window as unknown as { electronAPI?: { isElectron: boolean } }).electronAPI?.isElectron

  // Electron yazıcı listesini yükle
  useEffect(() => {
    if (isElectron) {
      const api = (window as unknown as { electronAPI: { getPrinters: () => Promise<{ name: string; isDefault: boolean }[]> } }).electronAPI
      api.getPrinters().then(list => setSysPrinters(list)).catch(() => {})
    }
  }, [isElectron])

  useEffect(() => {
    settingsApi.get()
      .then(({ data: res }) => {
        if (res.data) {
          const s = res.data
          setData({
            restaurantName: s.restaurantName ?? '',
            logoUrl:        s.logoUrl ?? undefined,
            address:        s.address ?? '',
            phone:          s.phone ?? '',
            taxNo:          s.taxNo ?? '',
            receiptFooter:  s.receiptFooter ?? 'Teşekkürler!',
            currency:       s.currency ?? 'TRY',
            timezone:       s.timezone ?? 'Europe/Istanbul',
          })
          if (s.logoUrl) setLogoPreview(`${CONFIG.API_BASE}${s.logoUrl}`)
        }
      })
      .catch(() => toast.error('Ayarlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleLogoRemove = () => {
    setLogoFile(null)
    setLogoPreview(undefined)
    setData(d => ({ ...d, logoUrl: undefined }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return
    setUploading(true)
    try {
      const { data: res } = await settingsApi.uploadLogo(logoFile)
      if (res.data) {
        const url = `${CONFIG.API_BASE}${res.data.url}`
        setLogoPreview(url)
        setData(d => ({ ...d, logoUrl: res.data!.url }))
        setLogoFile(null)
        toast.success('Logo yüklendi')
        window.dispatchEvent(new CustomEvent('settings:updated'))
      }
    } catch {
      toast.error('Logo yüklenemedi')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!data.restaurantName.trim()) {
      toast.error('Restoran adı boş olamaz')
      return
    }
    setSaving(true)
    try {
      // Upload logo first if a new file was selected
      if (logoFile) await handleLogoUpload()

      await settingsApi.update({
        restaurantName: data.restaurantName.trim(),
        address:        data.address.trim(),
        phone:          data.phone.trim(),
        taxNo:          data.taxNo.trim(),
        receiptFooter:  data.receiptFooter.trim(),
        currency:       data.currency,
        timezone:       data.timezone,
      })
      // Yazıcı tercihleri localStorage'a kaydet
      localStorage.setItem('gastro_printer_name', printerName)
      localStorage.setItem('gastro_paper_width',  paperWidth)
      toast.success('Ayarlar kaydedildi')
      window.dispatchEvent(new CustomEvent('settings:updated'))
    } catch {
      toast.error('Ayarlar kaydedilemedi')
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Restoran Ayarları</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body">Logo, isim ve genel bilgiler</p>
        </div>
        <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>
          Kaydet
        </Button>
      </div>

      {/* Logo */}
      <Card>
        <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4">Logo</h2>
        <div className="flex items-center gap-5">
          {/* Preview */}
          <div className="relative flex-shrink-0">
            {logoPreview ? (
              <div className="relative w-20 h-20 rounded-2xl overflow-hidden border border-[var(--color-border)]">
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                <button
                  onClick={handleLogoRemove}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent)]/60 flex items-center justify-center border border-[var(--color-border)]">
                <span className="text-[var(--color-accent-text)] font-display font-black text-2xl">
                  {data.restaurantName?.[0]?.toUpperCase() || 'G'}
                </span>
              </div>
            )}
          </div>

          {/* Upload controls */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleLogoSelect}
            />
            <Button
              variant="secondary"
              icon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
              size="sm"
            >
              {logoPreview ? 'Logo Değiştir' : 'Logo Yükle'}
            </Button>
            {logoFile && (
              <Button
                variant="primary"
                icon={<Save size={14} />}
                loading={uploading}
                onClick={handleLogoUpload}
                size="sm"
              >
                Logoyu Kaydet
              </Button>
            )}
            <p className="text-xs text-[var(--color-text-muted)] font-body">
              PNG, JPG, WebP veya SVG · Maks 5 MB
            </p>
          </div>
        </div>
      </Card>

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
          {/* Kağıt boyutu */}
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

          {/* Yazıcı seçimi — sadece Electron'da */}
          {isElectron && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Varsayılan Yazıcı</label>
              {sysPrinters.length > 0 ? (
                <select
                  value={printerName}
                  onChange={e => setPrinterName(e.target.value)}
                  className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 transition-colors"
                >
                  <option value="">— Varsayılan sistem yazıcısı —</option>
                  {sysPrinters.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name}{p.isDefault ? ' (varsayılan)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)] font-body py-2">
                  Yazıcı bulunamadı. USB yazıcınızın bağlı ve sürücüsünün kurulu olduğundan emin olun.
                </p>
              )}
            </div>
          )}

          {/* Tarayıcı modu için ipucu */}
          {!isElectron && (
            <div className="rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)] font-body space-y-1">
              <p className="font-semibold text-[var(--color-text)]">Tarayıcıdan Termal Yazıcı Kullanımı</p>
              <p>1. Fiş ekranında <strong>Yazdır</strong> butonuna tıklayın</p>
              <p>2. Yazıcı listesinden termal yazıcınızı seçin</p>
              <p>3. Kağıt boyutunu <strong>{paperWidth}</strong> olarak ayarlayın</p>
              <p>4. Kenar boşluklarını <strong>Yok</strong> yapın</p>
              <p className="text-[var(--color-accent)]">💡 Electron masaüstü uygulamasında yazıcı seçimi ve sessiz yazdırma desteklenir.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-4">
        <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>
          Kaydet
        </Button>
      </div>
    </div>
  )
}
