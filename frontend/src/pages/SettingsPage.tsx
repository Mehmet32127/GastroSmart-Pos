import React, { useState, useEffect } from 'react'
import { Save, Building2, Phone, FileText, Globe, Receipt, Printer } from 'lucide-react'
import { Card } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { settingsApi } from '@/api/settings'
import { setActiveCurrency } from '@/utils/format'
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

  // Yazıcı ayarları — localStorage'da tutulur (sunucu gerektirmez)
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>(() =>
    (localStorage.getItem('gastro_paper_width') as '58mm' | '80mm') ?? '80mm'
  )

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
        }
      })
      .catch(() => toast.error('Ayarlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!data.restaurantName.trim()) {
      toast.error('Restoran adı boş olamaz')
      return
    }
    setSaving(true)
    try {
      await settingsApi.update({
        restaurantName: data.restaurantName.trim(),
        address:        data.address.trim(),
        phone:          data.phone.trim(),
        taxNo:          data.taxNo.trim(),
        receiptFooter:  data.receiptFooter.trim(),
        currency:       data.currency,
        timezone:       data.timezone,
      })
      localStorage.setItem('gastro_paper_width', paperWidth)
      setActiveCurrency(data.currency)
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
          <p className="text-sm text-[var(--color-text-muted)] font-body">Genel bilgiler ve sistem ayarları</p>
        </div>
        <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>
          Kaydet
        </Button>
      </div>

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

      {/* Save button (bottom) */}
      <div className="flex justify-end pb-4">
        <Button icon={<Save size={16} />} loading={saving} onClick={handleSave}>
          Kaydet
        </Button>
      </div>
    </div>
  )
}
