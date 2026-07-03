import React, { useEffect, useState, useCallback } from 'react'
import {
  QrCode, Link2, Download, RefreshCw, Trash2, ShieldCheck,
  AlertTriangle, CheckCircle2, Image as ImageIcon, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, Spinner, Badge, EmptyState } from '@/components/ui/common'
import { ConfirmDialog } from '@/components/ui/Modal'
import { integrationApi } from '@/api/integration'
import type { PreviewResult, Integration } from '@/api/integration'
import { formatCurrency, cn } from '@/utils/format'
import toast from 'react-hot-toast'

/**
 * QR Menü Entegrasyonu — restoranın KENDİ (dış) QR menüsünü URL ile GastroSmart'a
 * taşır + sürekli senkron tutar. Yasal: yalnızca "kendi menüm" senaryosu, import
 * öncesi sahiplik onayı zorunlu.
 */
export const QrIntegrationPage: React.FC = () => {
  const [url, setUrl] = useState('')
  const [importImages, setImportImages] = useState(false)
  const [ownership, setOwnership] = useState(false)

  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)

  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const { data } = await integrationApi.list()
      setIntegrations(data.data || [])
    } catch { /* sessiz */ }
    finally { setLoadingList(false) }
  }, [])
  useEffect(() => { loadList() }, [loadList])

  const handlePreview = async () => {
    if (!url.trim()) { toast.error('Önce bir menü bağlantısı yapıştır'); return }
    setPreviewing(true)
    setPreview(null)
    try {
      const { data } = await integrationApi.preview(url.trim(), importImages)
      setPreview(data.data!)
      if (!data.data!.count) toast('Ürün bulunamadı', { icon: 'ℹ️' })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Önizleme başarısız')
    } finally {
      setPreviewing(false)
    }
  }

  const handleImport = async () => {
    if (!ownership) { toast.error('Önce sahiplik onayını işaretle'); return }
    if (!preview?.count) { toast.error('İçe aktarılacak ürün yok'); return }
    setImporting(true)
    try {
      const { data } = await integrationApi.import({
        url: url.trim(),
        importImages,
        ownershipConfirmed: ownership,
        deactivateMissing: false,
      })
      const c = data.data!.counts
      toast.success(`${c.added} eklendi, ${c.updated} güncellendi, ${c.skipped} atlandı`)
      setPreview(null)
      setUrl('')
      setOwnership(false)
      loadList()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'İçe aktarma başarısız')
    } finally {
      setImporting(false)
    }
  }

  const toggleSync = async (intg: Integration) => {
    setBusyId(intg.id)
    try {
      const { data } = await integrationApi.update(intg.id, { syncEnabled: !intg.syncEnabled })
      setIntegrations((prev) => prev.map((x) => (x.id === intg.id ? data.data! : x)))
      toast.success(!intg.syncEnabled ? 'Otomatik senkron açıldı' : 'Otomatik senkron kapatıldı')
    } catch { toast.error('Ayar kaydedilemedi') }
    finally { setBusyId(null) }
  }

  const changeInterval = async (intg: Integration, minutes: number) => {
    setBusyId(intg.id)
    try {
      const { data } = await integrationApi.update(intg.id, { syncIntervalMinutes: minutes })
      setIntegrations((prev) => prev.map((x) => (x.id === intg.id ? data.data! : x)))
    } catch { toast.error('Ayar kaydedilemedi') }
    finally { setBusyId(null) }
  }

  const syncNow = async (intg: Integration) => {
    setBusyId(intg.id)
    try {
      const { data } = await integrationApi.syncNow(intg.id)
      const c = data.data!.counts
      setIntegrations((prev) => prev.map((x) => (x.id === intg.id ? data.data!.integration : x)))
      toast.success(`Senkron: +${c.added} yeni, ~${c.updated} güncel, ✕${c.deactivated} pasif`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Senkron başarısız')
    } finally { setBusyId(null) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await integrationApi.remove(deleteId)
      toast.success('Entegrasyon kaldırıldı (ürünler menüde kalır)')
      setDeleteId(null)
      loadList()
    } catch { toast.error('Kaldırılamadı') }
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center flex-shrink-0">
          <QrCode size={24} className="text-[var(--color-accent)]" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-[var(--color-text)]">QR Menü Entegrasyonu</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-body mt-0.5">
            Kendi mevcut QR menünün bağlantısını yapıştır, ürünleri GastroSmart'a aktar ve otomatik güncel tut.
          </p>
        </div>
      </div>

      {/* Yasal not */}
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] leading-relaxed text-amber-200/90 font-body">
          Bu araç <strong>kendi menünü taşımak</strong> içindir. Yalnızca herkese açık sayfalar okunur.
          Başkasına ait menü/fotoğrafların izinsiz kopyalanması telif hakkı ihlali olabilir — sorumluluk sana aittir.
        </p>
      </div>

      {/* URL + önizle */}
      <Card className="!p-4 space-y-3">
        <label className="block text-sm font-medium text-[var(--color-text)] font-body">Menü Bağlantısı (URL)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePreview() }}
              placeholder="https://... (QR menünün açıldığı adres)"
              className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/40 font-body"
            />
          </div>
          <Button icon={<Download size={16} />} onClick={handlePreview} loading={previewing}>
            Önizle
          </Button>
        </div>

        <label className="flex items-center gap-2 text-sm font-body text-[var(--color-text-muted)] cursor-pointer w-fit">
          <input type="checkbox" checked={importImages} onChange={(e) => setImportImages(e.target.checked)} className="rounded" />
          <ImageIcon size={14} /> Görselleri de içe aktar
        </label>
      </Card>

      {/* Önizleme sonucu */}
      {preview && (
        <Card className="!p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text)] font-body">
                {preview.count} ürün bulundu
              </span>
              {preview.adapter && (
                <Badge variant={preview.adapter === 'gastrosmart' ? 'success' : 'muted'}>
                  {preview.adapter === 'gastrosmart' ? 'GastroSmart/Zexra (güvenilir)' : `kaynak: ${preview.adapter}`}
                </Badge>
              )}
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <div className="space-y-1">
              {preview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-amber-300/90 font-body">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {w}
                </div>
              ))}
            </div>
          )}

          {preview.count > 0 && (
            <>
              <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {preview.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    {importImages && it.imageUrl ? (
                      <img src={it.imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-surface2)] flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={14} className="text-[var(--color-text-muted)]/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text)] font-body truncate">{it.name}</p>
                      {it.categoryName && <p className="text-[10px] text-[var(--color-text-muted)] font-body truncate">{it.categoryName}</p>}
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--color-accent)] flex-shrink-0">
                      {formatCurrency(it.price)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Sahiplik onayı + içe aktar */}
              <label className="flex items-start gap-2 text-xs font-body text-[var(--color-text)] cursor-pointer p-2.5 rounded-xl bg-[var(--color-surface2)]/60">
                <input type="checkbox" checked={ownership} onChange={(e) => setOwnership(e.target.checked)} className="rounded mt-0.5" />
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[var(--color-accent)]" />
                  Bu menünün bana ait olduğunu / kullanım hakkım olduğunu onaylıyorum.
                </span>
              </label>

              <Button fullWidth icon={<Download size={16} />} onClick={handleImport} loading={importing} disabled={!ownership}>
                {preview.count} Ürünü İçe Aktar
              </Button>
            </>
          )}
        </Card>
      )}

      {/* Kayıtlı entegrasyonlar + otomatik senkron */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw size={15} className="text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)] font-body">Otomatik Senkron</h2>
        </div>

        {loadingList ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : integrations.length === 0 ? (
          <EmptyState
            icon={<Link2 size={22} />}
            title="Henüz entegrasyon yok"
            description="Yukarıdan bir menü içe aktardığında burada listelenir ve otomatik senkron açabilirsin."
          />
        ) : (
          <div className="space-y-2.5">
            {integrations.map((intg) => (
              <Card key={intg.id} className="!p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--color-text)] font-body truncate">{intg.sourceUrl}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {intg.lastStatus === 'ok' && (
                        <span className="flex items-center gap-1 text-[10px] text-green-400 font-body">
                          <CheckCircle2 size={11} /> Son senkron başarılı
                        </span>
                      )}
                      {intg.lastStatus === 'error' && (
                        <span className="flex items-center gap-1 text-[10px] text-red-400 font-body" title={intg.lastError || ''}>
                          <AlertTriangle size={11} /> Hata: {intg.lastError?.slice(0, 40)}
                        </span>
                      )}
                      {intg.lastSyncedAt && (
                        <span className="text-[10px] text-[var(--color-text-muted)] font-body">
                          {new Date(intg.lastSyncedAt).toLocaleString('tr-TR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setDeleteId(intg.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    title="Entegrasyonu kaldır">
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSync(intg)}
                      disabled={busyId === intg.id}
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                        intg.syncEnabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface2)] border border-[var(--color-border)]',
                      )}
                      title={intg.syncEnabled ? 'Otomatik senkron açık' : 'Kapalı'}
                    >
                      <span className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                        intg.syncEnabled ? 'translate-x-5' : 'translate-x-0.5',
                      )} />
                    </button>
                    <span className="text-xs font-body text-[var(--color-text-muted)]">
                      {intg.syncEnabled ? 'Otomatik açık' : 'Otomatik kapalı'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={intg.syncIntervalMinutes}
                      onChange={(e) => changeInterval(intg, Number(e.target.value))}
                      disabled={busyId === intg.id}
                      className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-xs font-body text-[var(--color-text)] focus:outline-none"
                    >
                      <option value={15}>15 dk'da bir</option>
                      <option value={30}>30 dk'da bir</option>
                      <option value={60}>Saatte bir</option>
                      <option value={360}>6 saatte bir</option>
                      <option value={720}>12 saatte bir</option>
                      <option value={1440}>Günde bir</option>
                    </select>
                    <Button size="xs" variant="secondary" icon={<RefreshCw size={13} />}
                      onClick={() => syncNow(intg)} loading={busyId === intg.id}>
                      Şimdi Senkronla
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog isOpen={!!deleteId} onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)} title="Entegrasyonu Kaldır"
        message="Bu entegrasyon silinecek. Daha önce aktarılan ürünler menüde kalır. Emin misiniz?"
        confirmText="Kaldır" danger />
    </div>
  )
}
