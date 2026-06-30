import React, { useState } from 'react'
import { Printer, Bluetooth, BluetoothConnected, Check, Eye, ChefHat, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { usePrinterStore } from '@/store/printerStore'
import type { PaperWidth } from '@/utils/escpos'
import { renderReceiptCanvas, type ReceiptBlock } from '@/utils/receipt'
import type { PrinterRole } from '@/services/btPrinter'
import { useSettingsStore } from '@/store/settingsStore'
import toast from 'react-hot-toast'

// Örnek fişler — önizleme + test baskısı için
const sampleBill = (name: string): ReceiptBlock[] => [
  { type: 'center', text: name, bold: true, size: 'lg' },
  { type: 'divider' },
  { type: 'row', left: 'Masa 5', right: '12.06.2026  19:42', size: 'sm' },
  { type: 'divider' },
  { type: 'left', text: '1 x Serpme Kahvaltı' },
  { type: 'row', left: '', right: '₺800,00', size: 'sm' },
  { type: 'left', text: '2 x Çay' },
  { type: 'row', left: '', right: '₺30,00', size: 'sm' },
  { type: 'divider' },
  { type: 'row', left: 'TOPLAM', right: '₺830,00', bold: true },
  { type: 'row', left: 'Ödeme', right: 'Nakit', size: 'sm' },
  { type: 'divider' },
  { type: 'center', text: 'Teşekkürler! (çğıöşü)', size: 'sm' },
]

const sampleKitchen = (): ReceiptBlock[] => [
  { type: 'center', text: 'MUTFAK', bold: true, size: 'lg' },
  { type: 'row', left: 'Masa 5', right: '19:42', size: 'sm' },
  { type: 'divider' },
  { type: 'left', text: '1 x Serpme Kahvaltı', bold: true },
  { type: 'left', text: '2 x Çay', bold: true },
  { type: 'left', text: '  > az şekerli' , size: 'sm' },
  { type: 'divider' },
]

const ROLE_META: Record<PrinterRole, { label: string; icon: React.ReactNode; sample: (n: string) => ReceiptBlock[] }> = {
  kitchen: { label: 'Mutfak Yazıcısı', icon: <ChefHat size={16} className="text-[var(--color-accent)]" />, sample: () => sampleKitchen() },
  cashier: { label: 'Kasa Yazıcısı (Hesap)', icon: <Receipt size={16} className="text-[var(--color-accent)]" />, sample: (n) => sampleBill(n) },
}

const PrinterRow: React.FC<{ role: PrinterRole }> = ({ role }) => {
  const state = usePrinterStore((s) => s[role])
  const { connect, disconnect, print } = usePrinterStore()
  const restaurantName = useSettingsStore((s) => s.restaurantName)
  const [busy, setBusy] = useState(false)
  const meta = ROLE_META[role]
  const connected = state.status === 'connected'

  const handleConnect = async () => {
    setBusy(true)
    try { await connect(role); toast.success(`${meta.label} bağlandı`) }
    catch (err) {
      const msg = (err as Error)?.message || 'Bağlanılamadı'
      if (!/cancel|user gesture|chooser/i.test(msg)) toast.error(msg)
    } finally { setBusy(false) }
  }

  const handleTest = async () => {
    setBusy(true)
    try {
      const m = await print(meta.sample(restaurantName), { role, cut: true })
      toast.success(m === 'bluetooth' ? 'Test fişi yazıcıya gönderildi' : 'Yazdırma penceresi açıldı')
    } catch (err) { toast.error((err as Error)?.message || 'Yazdırılamadı') }
    finally { setBusy(false) }
  }

  return (
    <div className="p-3 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {meta.icon}
          <div className="min-w-0">
            <p className="text-sm font-body text-[var(--color-text)] font-semibold">{meta.label}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] font-body truncate flex items-center gap-1">
              {connected
                ? <><BluetoothConnected size={11} className="text-green-400" /> {state.deviceName}</>
                : state.status === 'connecting' ? 'Bağlanıyor…' : 'Bağlı değil'}
            </p>
          </div>
        </div>
        {connected ? (
          <Button variant="secondary" size="sm" onClick={() => disconnect(role)} disabled={busy}>Kes</Button>
        ) : (
          <Button size="sm" icon={<Bluetooth size={14} />} onClick={handleConnect} loading={busy || state.status === 'connecting'}>Bağlan</Button>
        )}
      </div>
      <Button variant="secondary" size="sm" icon={<Printer size={13} />} onClick={handleTest} disabled={busy} fullWidth>
        Test Fişi Bas
      </Button>
    </div>
  )
}

export const PrinterCard: React.FC = () => {
  const { paper, supported, setPaper } = usePrinterStore()
  const restaurantName = useSettingsStore((s) => s.restaurantName)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const showPreview = (which: PrinterRole) => {
    const blocks = ROLE_META[which].sample(restaurantName)
    const canvas = renderReceiptCanvas(blocks, paper)
    setPreviewUrl(canvas.toDataURL('image/png'))
    setPreviewTitle(which === 'kitchen' ? 'Mutfak Fişi' : 'Hesap Fişi')
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold font-display text-[var(--color-text)] flex items-center gap-2 mb-1">
        <Printer size={16} className="text-[var(--color-accent)]" /> Adisyon Yazıcıları
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] font-body mb-4">
        İki ayrı Bluetooth yazıcı: <b>mutfak</b> sipariş fişi, <b>kasa</b> hesap fişi.
        Bağlı olmayan rol için fiş, tarayıcının yazdırma penceresiyle basılır.
      </p>

      {!supported ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400 font-body">
          Bu tarayıcı Web Bluetooth desteklemiyor. Android'de <b>Chrome</b> kullanın.
          Yine de fişler yazdırma penceresiyle basılabilir.
        </div>
      ) : (
        <>
          <div className="space-y-2.5 mb-4">
            <PrinterRow role="kitchen" />
            <PrinterRow role="cashier" />
          </div>

          {/* Kağıt genişliği (ortak) */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] font-body mb-1.5">Kağıt Genişliği (her iki yazıcı)</label>
            <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] w-fit">
              {(['58mm', '80mm'] as PaperWidth[]).map((p) => (
                <button key={p} onClick={() => setPaper(p)}
                  className={`px-4 py-2 text-sm font-body transition-colors flex items-center gap-1.5 ${
                    paper === p
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}>
                  {paper === p && <Check size={13} />}{p}
                </button>
              ))}
            </div>
          </div>

          {/* Önizleme — iki fiş türü */}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={() => showPreview('kitchen')}>Mutfak Fişi Önizle</Button>
            <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={() => showPreview('cashier')}>Hesap Fişi Önizle</Button>
          </div>
        </>
      )}

      {/* Fiş önizleme — yazıcıya gidecek birebir görüntü */}
      <Modal isOpen={!!previewUrl} onClose={() => setPreviewUrl(null)} title={`Önizleme · ${previewTitle}`} subtitle={`${paper} · yazıcıya gidecek görüntü`} size="sm">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-[var(--color-text-muted)] font-body text-center">
            Bu görüntü, yazıcının basacağı fişin <b>birebir aynısıdır</b>.
          </p>
          {previewUrl && (
            <div className="bg-white rounded-lg p-2 shadow-inner max-h-[60vh] overflow-y-auto">
              <img src={previewUrl} alt="Fiş önizleme" style={{ width: paper === '58mm' ? 240 : 320, imageRendering: 'pixelated' }} />
            </div>
          )}
        </div>
      </Modal>
    </Card>
  )
}
