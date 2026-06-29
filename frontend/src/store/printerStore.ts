import { create } from 'zustand'
import { btPrinter, type PrinterStatus } from '@/services/btPrinter'
import { buildPrintPayload, type PaperWidth } from '@/utils/escpos'
import { renderReceiptCanvas, blocksToHtml, type ReceiptBlock } from '@/utils/receipt'

type PrintMethod = 'bluetooth' | 'system'

interface PrinterState {
  status: PrinterStatus
  deviceName: string | null
  paper: PaperWidth
  supported: boolean
  init: () => void
  connect: () => Promise<void>
  disconnect: () => void
  setPaper: (p: PaperWidth) => void
  /** Fişi bas — BT bağlıysa raster, değilse sistem yazdırma diyaloğu. Yöntemi döner. */
  print: (blocks: ReceiptBlock[], opts?: { cut?: boolean }) => Promise<PrintMethod>
}

// Tüm uygulamada tek kağıt-boyutu kaynağı (eski "Termal Yazıcı" ayarıyla ortak)
const PAPER_KEY = 'gastro_paper_width'

let initialized = false

function printViaSystem(html: string) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow!.document
  doc.open(); doc.write(html); doc.close()
  setTimeout(() => {
    try { iframe.contentWindow!.focus(); iframe.contentWindow!.print() } catch { /* yoksay */ }
    setTimeout(() => iframe.remove(), 1500)
  }, 300)
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  status: 'disconnected',
  deviceName: null,
  paper: ((): PaperWidth => {
    const p = typeof localStorage !== 'undefined' ? localStorage.getItem(PAPER_KEY) : null
    return p === '80mm' ? '80mm' : '58mm'
  })(),
  supported: btPrinter.supported,

  init: () => {
    if (initialized) return
    initialized = true
    btPrinter.onChange((status, deviceName) => set({ status, deviceName }))
    // izin verilmiş yazıcıya sessizce yeniden bağlanmayı dene
    btPrinter.tryReconnect().catch(() => {})
  },

  connect: async () => {
    await btPrinter.connect()
  },

  disconnect: () => btPrinter.disconnect(),

  setPaper: (p) => {
    try { localStorage.setItem(PAPER_KEY, p) } catch { /* private mode */ }
    set({ paper: p })
  },

  print: async (blocks, opts) => {
    const { paper, status } = get()
    if (status === 'connected') {
      const canvas = renderReceiptCanvas(blocks, paper)
      const payload = buildPrintPayload(canvas, { cut: opts?.cut })
      await btPrinter.write(payload)
      return 'bluetooth'
    }
    printViaSystem(blocksToHtml(blocks, paper))
    return 'system'
  },
}))
