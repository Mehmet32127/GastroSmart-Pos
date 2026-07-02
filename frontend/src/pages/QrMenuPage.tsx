import React, { useEffect, useState, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, Printer, RefreshCw, Eye, ExternalLink, ShieldCheck, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Spinner, EmptyState } from '@/components/ui/common'
import { ConfirmDialog } from '@/components/ui/Modal'
import { tablesApi } from '@/api/tables'
import { settingsApi } from '@/api/settings'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/utils/format'
import type { Table } from '@/types'
import toast from 'react-hot-toast'

type QrRotateMode = 'off' | 'daily' | 'weekly'
const QR_MODES: { value: QrRotateMode; label: string; desc: string }[] = [
  { value: 'off',    label: 'Kapalı',   desc: 'Sadece manuel' },
  { value: 'daily',  label: 'Günlük',   desc: 'Her gece otomatik' },
  { value: 'weekly', label: 'Haftalık', desc: '7 günde bir' },
]

/**
 * QR Menü — restoranın QR merkezi (panel içinde, per-restoran).
 *  - Menümü Önizle: sahibi kendi Zexra menüsünü görür
 *  - Masa QR kodları: her masa için ayrı QR (token'lı), tek tek yenile
 *  - Tümünü Yazdır: tüm masa QR etiketlerini tek seferde bas
 *  - Güvenlik: otomatik/manuel token yenileme (eski/sızmış QR geçersiz olur)
 */
export const QrMenuPage: React.FC = () => {
  const user = useAuthStore((s) => s.user)
  const slug = user?.tenantSlug ?? ''
  const restaurantName = useSettingsStore((s) => s.restaurantName)

  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<QrRotateMode>('off')
  const [lastRotated, setLastRotated] = useState<string | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [rotatingAll, setRotatingAll] = useState(false)

  const base = `${window.location.origin}${import.meta.env.BASE_URL}zexra/menu.html?slug=${encodeURIComponent(slug)}`
  const previewUrl = base
  const tableUrl = (t: Table) => `${base}&masa=${t.number}${t.qrToken ? `&t=${t.qrToken}` : ''}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, s] = await Promise.all([tablesApi.getAll(), settingsApi.get()])
      setTables((t.data.data || []).slice().sort((a, b) => a.number - b.number))
      if (s.data.data?.qrAutoRotate) setMode(s.data.data.qrAutoRotate)
      if (s.data.data?.qrLastRotated) setLastRotated(s.data.data.qrLastRotated)
    } catch { toast.error('QR bilgileri yüklenemedi') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const changeMode = async (m: QrRotateMode) => {
    const prev = mode
    setMode(m)
    try {
      await settingsApi.update({ qrAutoRotate: m })
      toast.success(m === 'off' ? 'Otomatik yenileme kapatıldı' : `QR'lar ${m === 'daily' ? 'her gece' : 'haftada bir'} yenilenecek`)
    } catch { setMode(prev); toast.error('Ayar kaydedilemedi') }
  }

  const rotateOne = async (t: Table) => {
    setRotatingId(t.id)
    try {
      const { data } = await tablesApi.rotateQr(t.id)
      if (data.data) setTables((prev) => prev.map((x) => (x.id === t.id ? data.data! : x)))
      toast.success(`${t.name} QR yenilendi — eski QR geçersiz`)
    } catch { toast.error('QR yenilenemedi') }
    finally { setRotatingId(null) }
  }

  const rotateAll = async () => {
    setConfirmAll(false); setRotatingAll(true)
    try {
      await tablesApi.rotateAllQr()
      setLastRotated(new Date().toISOString())
      await load()
      toast.success('Tüm QR kodları yenilendi — eski QR\'lar geçersiz')
    } catch { toast.error('QR kodları yenilenemedi') }
    finally { setRotatingAll(false) }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — baskıda gizli */}
      <div className="print:hidden flex flex-wrap items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex-1 min-w-[150px]">
          <h1 className="text-lg font-bold font-display text-[var(--color-text)] flex items-center gap-2">
            <QrCode size={18} className="text-[var(--color-accent)]" /> QR Menü
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] font-body">
            Masalara özel QR kodları — müşteri okutup sipariş verir & öder
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm" icon={<Eye size={14} />}>Menümü Önizle</Button>
          </a>
          <Button size="sm" icon={<Printer size={14} />} onClick={() => window.print()} disabled={!tables.length}>
            Tümünü Yazdır
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5 print:p-0 print:overflow-visible">
        {/* Güvenlik kartı — baskıda gizli */}
        <div className="print:hidden">
          <Card className="mb-5">
            <h2 className="text-sm font-semibold font-display text-[var(--color-text)] flex items-center gap-2 mb-1">
              <ShieldCheck size={16} className="text-[var(--color-accent)]" /> QR Güvenliği
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] font-body mb-3">
              QR kodları güvenlik kodu taşır; yenilenince eski (fotoğraflanmış) QR'larla sipariş verilemez.
              <b> Yenileme sonrası masalardaki QR etiketleri yeniden basılmalıdır.</b>
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-muted)] font-body mb-1.5">Otomatik Yenileme</label>
                <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
                  {QR_MODES.map((m) => (
                    <button key={m.value} onClick={() => changeMode(m.value)} title={m.desc}
                      className={cn('px-3.5 py-2 text-sm font-body transition-colors flex items-center gap-1.5',
                        mode === m.value
                          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                          : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}>
                      {mode === m.value && <Check size={13} />}{m.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={cn(rotatingAll && 'animate-spin')} />}
                onClick={() => setConfirmAll(true)} disabled={rotatingAll}>
                Tüm QR'ları Yenile
              </Button>
              {lastRotated && (
                <span className="text-[11px] text-[var(--color-text-muted)] font-body pb-1">
                  Son yenileme: {new Date(lastRotated).toLocaleString('tr-TR')}
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* ── EKRAN görünümü: masa QR kartları (baskıda gizli) ──────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center h-64 print:hidden"><Spinner size={32} /></div>
        ) : tables.length === 0 ? (
          <div className="print:hidden">
            <EmptyState icon={<QrCode size={24} />} title="Masa yok"
              description="Önce Masalar ekranından masa ekleyin, sonra QR kodları burada oluşur." />
          </div>
        ) : (
          <>
            <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tables.map((t) => (
                <div key={t.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 flex flex-col items-center gap-2 shadow-card">
                  <div className="bg-white p-2 rounded-xl"><QRCodeSVG value={tableUrl(t)} size={112} /></div>
                  <div className="text-center">
                    <p className="text-sm font-bold font-display text-[var(--color-text)]">{t.name}</p>
                    <p className="text-[10px] font-body flex items-center justify-center gap-1">
                      {t.qrToken
                        ? <span className="text-green-400 flex items-center gap-0.5"><ShieldCheck size={10} /> Korumalı</span>
                        : <span className="text-amber-400">Koruma yok</span>}
                    </p>
                  </div>
                  <button onClick={() => rotateOne(t)} disabled={rotatingId === t.id}
                    className="text-[11px] font-body text-[var(--color-text-muted)] hover:text-[var(--color-accent)] flex items-center gap-1 transition-colors">
                    <RefreshCw size={11} className={cn(rotatingId === t.id && 'animate-spin')} /> Yenile
                  </button>
                </div>
              ))}
            </div>

            {/* ── BASKI görünümü: yalnızca yazdırmada (@media print) ──────────────── */}
            <div className="hidden print:grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10mm' }}>
              {tables.map((t) => (
                <div key={t.id} style={{ breakInside: 'avoid', border: '1px dashed #999', borderRadius: '8px', padding: '6mm', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '13pt', color: '#000' }}>{restaurantName}</div>
                  <div style={{ fontSize: '11pt', color: '#333', marginBottom: '3mm' }}>{t.name}</div>
                  <QRCodeSVG value={tableUrl(t)} size={150} />
                  <div style={{ fontSize: '9pt', color: '#555', marginTop: '3mm' }}>Menü için okutun · QR ile sipariş</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog isOpen={confirmAll} onConfirm={rotateAll} onCancel={() => setConfirmAll(false)}
        title="Tüm QR Kodlarını Yenile"
        message="Tüm masaların QR güvenlik kodu değişecek. Eski/basılı QR kodlarla artık sipariş verilemez; QR etiketlerini yeniden basmanız gerekir. Devam edilsin mi?"
        confirmText="Yenile" danger />
    </div>
  )
}
