import { create } from 'zustand'
import { printers, type PrinterStatus, type PrinterRole } from '@/services/btPrinter'
import { buildPrintPayload, type PaperWidth } from '@/utils/escpos'
import { renderReceiptCanvas, blocksToHtml, type ReceiptBlock } from '@/utils/receipt'

type PrintMethod = 'bluetooth' | 'system'

interface RoleState { status: PrinterStatus; deviceName: string | null }

interface PrinterState {
  kitchen: RoleState
  cashier: RoleState
  paper: PaperWidth
  supported: boolean
  init: () => void
  connect: (role: PrinterRole) => Promise<void>
  disconnect: (role: PrinterRole) => void
  setPaper: (p: PaperWidth) => void
  /**
   * Fişi bas. role = hedef yazıcı (kitchen/cashier). O rol bağlıysa o yazıcıya
   * raster basar; bağlı değilse sistem yazdırma diyaloğuna düşer. Yöntemi döner.
   */
  print: (blocks: ReceiptBlock[], opts: { role: PrinterRole; cut?: boolean }) => Promise<PrintMethod>
}

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
  kitchen: { status: 'disconnected', deviceName: null },
  cashier: { status: 'disconnected', deviceName: null },
  paper: ((): PaperWidth => {
    const p = typeof localStorage !== 'undefined' ? localStorage.getItem(PAPER_KEY) : null
    return p === '80mm' ? '80mm' : '58mm'
  })(),
  supported: printers.kitchen.supported,

  init: () => {
    if (initialized) return
    initialized = true
    ;(['kitchen', 'cashier'] as PrinterRole[]).forEach((role) => {
      printers[role].onChange((status, deviceName) => set({ [role]: { status, deviceName } } as Pick<PrinterState, PrinterRole>))
      printers[role].tryReconnect().catch(() => {})
    })
  },

  connect: async (role) => { await printers[role].connect() },

  disconnect: (role) => printers[role].disconnect(),

  setPaper: (p) => {
    try { localStorage.setItem(PAPER_KEY, p) } catch { /* private mode */ }
    set({ paper: p })
  },

  print: async (blocks, opts) => {
    const { paper } = get()
    const printer = printers[opts.role]
    if (printer.status === 'connected') {
      const canvas = renderReceiptCanvas(blocks, paper)
      const payload = buildPrintPayload(canvas, { cut: opts.cut })
      await printer.write(payload)
      return 'bluetooth'
    }
    printViaSystem(blocksToHtml(blocks, paper))
    return 'system'
  },
}))
