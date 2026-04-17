import React, { useEffect, useRef, useState } from 'react'
import { Printer, Download, Zap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/common'
import { formatCurrency, formatDateTime } from '@/utils/format'
import client from '@/api/client'
import { CONFIG } from '@/config'
import type { Order } from '@/types'
import toast from 'react-hot-toast'

// Electron API type (injected via preload)
declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean
      getPrinters: () => Promise<{ name: string; isDefault: boolean; status: number }[]>
      printReceipt: (html: string, printerName: string, paperWidth: string) => Promise<{ success: boolean; error: string | null }>
      updateTrayIcon: (logoUrl: string) => Promise<void>
    }
  }
}

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ isOpen, onClose, order }) => {
  const iframeRef   = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [printing, setPrinting]     = useState(false)
  const [printers, setPrinters]     = useState<{ name: string; isDefault: boolean }[]>([])

  const isElectron  = !!window.electronAPI?.isElectron
  const receiptUrl  = `${CONFIG.API_BASE}/api/print/receipt/${order.id}/raw`

  // Saved printer preferences
  const savedPrinter = localStorage.getItem('gastro_printer_name') ?? ''
  const savedPaper   = (localStorage.getItem('gastro_paper_width') ?? '80mm') as '58mm' | '80mm'

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(false)
    // Load printer list in Electron
    if (isElectron) {
      window.electronAPI!.getPrinters().then(list => setPrinters(list)).catch(() => {})
    }
  }, [isOpen, order.id, isElectron])

  const getReceiptHtml = async (): Promise<string | null> => {
    try {
      const { data } = await client.get(`/print/receipt/${order.id}`)
      return data.data?.html ?? null
    } catch {
      return null
    }
  }

  // Electron: sessiz yazdır (dialog yok)
  const handleSilentPrint = async () => {
    if (!window.electronAPI) return
    setPrinting(true)
    try {
      const html = await getReceiptHtml()
      if (!html) { toast.error('Fiş verisi alınamadı'); return }
      const printerName = savedPrinter
      const result = await window.electronAPI.printReceipt(html, printerName, savedPaper)
      if (result.success) {
        toast.success('Yazıcıya gönderildi')
      } else {
        toast.error(`Yazıcı hatası: ${result.error ?? 'bilinmeyen'}`)
      }
    } catch {
      toast.error('Yazdırma başarısız')
    } finally {
      setPrinting(false)
    }
  }

  // Browser: iframe print (OS dialog açılır)
  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print()
    } else {
      const win = window.open(receiptUrl, '_blank', 'width=400,height=600')
      win?.addEventListener('load', () => win.print())
    }
  }

  const handleDownload = async () => {
    try {
      const html = await getReceiptHtml()
      if (!html) return
      const blob = new Blob([html], { type: 'text/html' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `fis-${order.id}-${order.tableName}.html`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  const activeItems = order.items.filter(i => i.status !== 'cancelled')
  const subtotal = activeItems.reduce((s, i) => s + i.totalPrice, 0)
  const discountAmount = order.discountType === 'percent'
    ? subtotal * (order.discount / 100)
    : order.discount
  const total = subtotal - discountAmount

  const paymentLabel: Record<string, string> = {
    cash: '💵 Nakit',
    card: '💳 Kart',
    mixed: '🔀 Nakit + Kart',
    complimentary: '🎁 İkram',
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Fiş"
      subtitle={`${order.tableName} · #${order.id}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" icon={<Download size={15} />} onClick={handleDownload}>
            İndir
          </Button>
          {isElectron ? (
            <Button
              icon={<Zap size={15} />}
              loading={printing}
              onClick={handleSilentPrint}
              title="Yazıcıya doğrudan gönder (dialog yok)"
            >
              Sessiz Yazdır
            </Button>
          ) : (
            <Button icon={<Printer size={15} />} onClick={handlePrint}>
              Yazdır
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {/* Fiş önizleme */}
        <div className="bg-white rounded-xl overflow-hidden border border-[var(--color-border)] relative" style={{ minHeight: 300 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <Spinner size={24} />
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={receiptUrl}
            className="w-full"
            style={{ height: 420, border: 'none' }}
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true) }}
            title="Fiş Önizleme"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 font-body text-center">
            Fiş yüklenemedi. Yine de yazdırabilirsiniz.
          </div>
        )}

        {/* Özet bilgiler */}
        <div className="bg-[var(--color-surface2)] rounded-xl p-3 border border-[var(--color-border)] space-y-1.5 text-xs font-body">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Adisyon No</span>
            <span className="font-mono">#{order.id}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Masa</span>
            <span>{order.tableName}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Garson</span>
            <span>{order.waiterName}</span>
          </div>
          {order.closedAt && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Tarih</span>
              <span>{formatDateTime(order.closedAt)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-[var(--color-text)] pt-1 border-t border-[var(--color-border)]">
            <span>Toplam</span>
            <span className="font-mono text-[var(--color-accent)]">{formatCurrency(total)}</span>
          </div>
          {order.paymentMethod && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Ödeme</span>
              <span>{paymentLabel[order.paymentMethod] || order.paymentMethod}</span>
            </div>
          )}
          {order.change > 0 && (
            <div className="flex justify-between text-green-400 font-semibold">
              <span>Para Üstü</span>
              <span className="font-mono">{formatCurrency(order.change)}</span>
            </div>
          )}
        </div>

        {/* Yazıcı bilgisi */}
        {isElectron && printers.length > 0 ? (
          <div className="text-[10px] text-[var(--color-text-muted)] font-body text-center">
            🖨️ Yazıcı: <span className="text-[var(--color-accent)]">{savedPrinter || printers.find(p => p.isDefault)?.name || printers[0]?.name || '—'}</span>
            {' · '}<span className="underline cursor-pointer hover:text-[var(--color-text)]" onClick={() => window.location.href = '/settings'}>Ayarla</span>
          </div>
        ) : !isElectron ? (
          <div className="text-[10px] text-[var(--color-text-muted)] font-body text-center">
            💡 Termal yazıcı: Yazdır → Yazıcı seç → Kağıt boyutu 80mm veya 58mm
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
