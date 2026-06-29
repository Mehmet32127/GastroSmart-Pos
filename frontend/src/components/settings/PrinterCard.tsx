import React, { useState } from 'react'
import { Printer, Bluetooth, BluetoothConnected, Check, Eye } from 'lucide-react'
import { Card } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { usePrinterStore } from '@/store/printerStore'
import type { PaperWidth } from '@/utils/escpos'
import { renderReceiptCanvas, type ReceiptBlock } from '@/utils/receipt'
import { useSettingsStore } from '@/store/settingsStore'
import toast from 'react-hot-toast'

const TEST_BLOCKS = (name: string): ReceiptBlock[] => [
  { type: 'center', text: name, bold: true, size: 'lg' },
  { type: 'center', text: 'Test Fişi', size: 'sm' },
  { type: 'divider' },
  { type: 'row', left: '1 x Çay', right: '₺15,00' },
  { type: 'row', left: '2 x Şiş Köfte', right: '₺170,00' },
  { type: 'left', text: '  > az pişmiş olsun' },
  { type: 'divider' },
  { type: 'row', left: 'TOPLAM', right: '₺185,00', bold: true },
  { type: 'divider' },
  { type: 'center', text: 'Türkçe: çğıöşü ÇĞİÖŞÜ', size: 'sm' },
  { type: 'center', text: 'Teşekkürler!', size: 'sm' },
]

export const PrinterCard: React.FC = () => {
  const { status, deviceName, paper, supported, connect, disconnect, setPaper, print } = usePrinterStore()
  const restaurantName = useSettingsStore((s) => s.restaurantName)
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const connected = status === 'connected'

  // Yazıcıya gidecek BİREBİR görüntüyü ekranda göster (fiziksel yazıcı gerekmez)
  const handlePreview = () => {
    const canvas = renderReceiptCanvas(TEST_BLOCKS(restaurantName), paper)
    setPreviewUrl(canvas.toDataURL('image/png'))
  }

  const handleConnect = async () => {
    setBusy(true)
    try {
      await connect()
      toast.success('Yazıcı bağlandı')
    } catch (err) {
      const msg = (err as Error)?.message || 'Bağlanılamadı'
      // Kullanıcı seçimi iptal ettiyse sessiz geç
      if (!/cancel|user gesture|chooser/i.test(msg)) toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    setBusy(true)
    try {
      const method = await print(TEST_BLOCKS(restaurantName), { cut: true })
      toast.success(method === 'bluetooth' ? 'Test fişi yazıcıya gönderildi' : 'Yazdırma penceresi açıldı')
    } catch (err) {
      toast.error((err as Error)?.message || 'Yazdırılamadı')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="text-sm font-semibold font-display text-[var(--color-text)] flex items-center gap-2 mb-1">
        <Printer size={16} className="text-[var(--color-accent)]" /> Adisyon Yazıcısı
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] font-body mb-4">
        Bluetooth termal yazıcı (BLE). Bağlı değilse fişler tarayıcının yazdırma penceresiyle basılır.
      </p>

      {!supported ? (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-400 font-body">
          Bu tarayıcı Web Bluetooth desteklemiyor. Android'de <b>Chrome</b> kullanın
          (veya kurulu uygulama). Yazıcı yoksa fişler yine de yazdırma penceresiyle basılabilir.
        </div>
      ) : (
        <>
          {/* Bağlantı durumu */}
          <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)]">
            <div className="flex items-center gap-2 min-w-0">
              {connected
                ? <BluetoothConnected size={18} className="text-green-400 flex-shrink-0" />
                : <Bluetooth size={18} className="text-[var(--color-text-muted)] flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-body text-[var(--color-text)] truncate">
                  {connected ? deviceName : status === 'connecting' ? 'Bağlanıyor…' : 'Bağlı değil'}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] font-body">
                  {connected ? 'Hazır' : 'Yazıcı seç ve bağlan'}
                </p>
              </div>
            </div>
            {connected ? (
              <Button variant="secondary" size="sm" onClick={disconnect} disabled={busy}>Kes</Button>
            ) : (
              <Button size="sm" icon={<Bluetooth size={14} />} onClick={handleConnect} loading={busy || status === 'connecting'}>
                Bağlan
              </Button>
            )}
          </div>

          {/* Kağıt genişliği */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[var(--color-text-muted)] font-body mb-1.5">Kağıt Genişliği</label>
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

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={handlePreview} disabled={busy}>
              Önizleme
            </Button>
            <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={handleTest} disabled={busy}>
              Test Fişi Bas
            </Button>
          </div>
        </>
      )}

      {/* Fiş önizleme — yazıcıya gidecek birebir görüntü */}
      <Modal isOpen={!!previewUrl} onClose={() => setPreviewUrl(null)} title="Fiş Önizleme" subtitle={`${paper} · yazıcıya gidecek görüntü`} size="sm">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-[var(--color-text-muted)] font-body text-center">
            Aşağıdaki görüntü, Bluetooth yazıcının basacağı fişin <b>birebir aynısıdır</b>.
          </p>
          {previewUrl && (
            <div className="bg-white rounded-lg p-2 shadow-inner max-h-[60vh] overflow-y-auto">
              <img src={previewUrl} alt="Fiş önizleme"
                style={{ width: paper === '58mm' ? 240 : 320, imageRendering: 'pixelated' }} />
            </div>
          )}
        </div>
      </Modal>
    </Card>
  )
}
