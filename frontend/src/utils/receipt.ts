// Fiş içeriği: yapısal "blok" listesi olarak tanımlanır, sonra hem CANVAS'a
// (Bluetooth raster baskı) hem HTML'e (window.print fallback) render edilir.
// Tek kaynak → iki çıktı, böylece müşteri fişi ve mutfak fişi her iki yolda da aynı.

import type { Order } from '@/types'
import { PAPER_DOTS, type PaperWidth } from './escpos'

export type ReceiptBlock =
  | { type: 'center'; text: string; bold?: boolean; size?: 'sm' | 'md' | 'lg' }
  | { type: 'left'; text: string; bold?: boolean; size?: 'sm' | 'md' | 'lg' }
  | { type: 'row'; left: string; right: string; bold?: boolean; size?: 'sm' | 'md' }
  | { type: 'divider' }
  | { type: 'space'; h?: number }

const SIZE_PX = { sm: 20, md: 24, lg: 34 }

function tl(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0)
}

/** Metni verilen genişliğe sığacak şekilde satırlara böler (kelime bazlı). */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (!text) return ['']
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(test).width > maxW) { lines.push(cur); cur = w }
    else cur = test
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// ─── CANVAS render (Bluetooth raster) ─────────────────────────────────────────

/**
 * Blokları monokrom canvas'a çizer. Genişlik yazıcı nokta sayısı (384/576).
 * Türkçe karakterler sistem fontuyla çizildiği için sorunsuz çıkar.
 * Uzun metinler genişliğe göre satıra sarılır (kırpılmaz).
 */
export function renderReceiptCanvas(blocks: ReceiptBlock[], paper: PaperWidth): HTMLCanvasElement {
  const W = PAPER_DOTS[paper]
  const padX = 8
  const lineGap = 6
  const maxW = W - padX * 2

  const fontFor = (size: 'sm' | 'md' | 'lg' = 'md', bold = false) =>
    `${bold ? 'bold ' : ''}${SIZE_PX[size]}px "Courier New", monospace`

  // Ölçüm context'i (satır sarma için measureText)
  const mctx = document.createElement('canvas').getContext('2d')!

  // Pass 1: blokları çizilebilir işlemlere çöz + toplam yükseklik
  type Op =
    | { kind: 'lines'; lines: string[]; align: 'center' | 'left'; font: string; lh: number }
    | { kind: 'row'; left: string; right: string; font: string; lh: number }
    | { kind: 'divider'; h: number }
    | { kind: 'space'; h: number }
  const ops: Op[] = []
  let height = 12

  for (const b of blocks) {
    if (b.type === 'divider') { ops.push({ kind: 'divider', h: 14 }); height += 14; continue }
    if (b.type === 'space') { const h = b.h ?? 12; ops.push({ kind: 'space', h }); height += h; continue }
    const size = b.size ?? 'md'
    const font = fontFor(size, b.bold)
    const lh = SIZE_PX[size] + lineGap
    mctx.font = font
    if (b.type === 'row') {
      ops.push({ kind: 'row', left: b.left, right: b.right, font, lh }); height += lh
    } else {
      const lines = wrapText(mctx, b.text, maxW)
      ops.push({ kind: 'lines', lines, align: b.type === 'center' ? 'center' : 'left', font, lh })
      height += lh * lines.length
    }
  }
  height += 12

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = Math.ceil(height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, canvas.height)
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'top'

  let y = 12
  for (const op of ops) {
    if (op.kind === 'divider') {
      ctx.save()
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(padX, y + 4); ctx.lineTo(W - padX, y + 4); ctx.stroke()
      ctx.restore()
      y += op.h; continue
    }
    if (op.kind === 'space') { y += op.h; continue }
    ctx.font = op.font
    if (op.kind === 'row') {
      ctx.fillText(op.left, padX, y)
      const rw = ctx.measureText(op.right).width
      ctx.fillText(op.right, W - padX - rw, y)
      y += op.lh
    } else {
      for (const line of op.lines) {
        if (op.align === 'center') {
          const tw = ctx.measureText(line).width
          ctx.fillText(line, Math.max(padX, (W - tw) / 2), y)
        } else {
          ctx.fillText(line, padX, y)
        }
        y += op.lh
      }
    }
  }
  return canvas
}

// ─── HTML render (window.print fallback) ──────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function blocksToHtml(blocks: ReceiptBlock[], paper: PaperWidth): string {
  const width = paper === '58mm' ? '58mm' : '80mm'
  const rows = blocks.map((b) => {
    if (b.type === 'divider') return '<div class="hr"></div>'
    if (b.type === 'space') return `<div style="height:${b.h ?? 8}px"></div>`
    const size = (b as { size?: 'sm' | 'md' | 'lg' }).size
    const fs = size === 'lg' ? 16 : size === 'sm' ? 11 : 13
    const bold = (b as { bold?: boolean }).bold ? 'font-weight:bold;' : ''
    if (b.type === 'center') return `<div style="text-align:center;font-size:${fs}px;${bold}">${esc(b.text)}</div>`
    if (b.type === 'left') return `<div style="font-size:${fs}px;${bold}">${esc(b.text)}</div>`
    return `<div class="row" style="font-size:${fs}px;${bold}"><span>${esc(b.left)}</span><span>${esc(b.right)}</span></div>`
  }).join('')
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',monospace;width:${width};padding:3mm;color:#000}
    .hr{border-top:1px dashed #000;margin:4px 0}
    .row{display:flex;justify-content:space-between;gap:8px}
    .row span:last-child{text-align:right;white-space:nowrap}
    @media print{@page{margin:0;size:${width} auto}}
  </style></head><body>${rows}</body></html>`
}

// ─── Şablonlar ────────────────────────────────────────────────────────────────

interface ReceiptHeader {
  restaurantName: string
  address?: string
  phone?: string
  footer?: string
}

function nowStr() {
  const tz = { timeZone: 'Europe/Istanbul' as const }
  const d = new Intl.DateTimeFormat('tr-TR', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())
  const t = new Intl.DateTimeFormat('tr-TR', { ...tz, hour: '2-digit', minute: '2-digit' }).format(new Date())
  return `${d}  ${t}`
}

/** Müşteri hesap fişi — fiyatlar, indirim, toplam, ödeme yöntemi. */
export function buildBillBlocks(order: Order, h: ReceiptHeader): ReceiptBlock[] {
  const items = order.items.filter((i) => i.status !== 'cancelled')
  const blocks: ReceiptBlock[] = [
    { type: 'center', text: h.restaurantName, bold: true, size: 'lg' },
  ]
  if (h.address) blocks.push({ type: 'center', text: h.address, size: 'sm' })
  if (h.phone) blocks.push({ type: 'center', text: 'Tel: ' + h.phone, size: 'sm' })
  blocks.push({ type: 'divider' })
  blocks.push({ type: 'row', left: order.tableName || 'Masa', right: nowStr(), size: 'sm' })
  blocks.push({ type: 'divider' })

  for (const it of items) {
    blocks.push({ type: 'left', text: `${it.quantity} x ${it.menuItemName}` })
    blocks.push({ type: 'row', left: '', right: tl(it.totalPrice), size: 'sm' })
    if (it.note) blocks.push({ type: 'left', text: '  > ' + it.note, size: 'sm' })
  }
  blocks.push({ type: 'divider' })
  blocks.push({ type: 'row', left: 'Ara Toplam', right: tl(order.subtotal) })
  if (order.discount > 0) {
    const disc = order.discountType === 'percent' ? `%${order.discount}` : tl(order.discount)
    blocks.push({ type: 'row', left: 'İndirim', right: '-' + disc })
  }
  blocks.push({ type: 'row', left: 'TOPLAM', right: tl(order.total), bold: true })
  const pm = { cash: 'Nakit', card: 'Kart', mixed: 'Nakit+Kart', complimentary: 'İkram' }[order.paymentMethod as string]
  if (pm) blocks.push({ type: 'row', left: 'Ödeme', right: pm, size: 'sm' })
  blocks.push({ type: 'divider' })
  blocks.push({ type: 'center', text: h.footer || 'Teşekkürler!', size: 'sm' })
  return blocks
}

/** Mutfak sipariş fişi — fiyatsız, ürün+adet+not; mutfağa gider. */
export function buildKitchenBlocks(order: Order, opts?: { onlyPending?: boolean }): ReceiptBlock[] {
  let items = order.items.filter((i) => i.status !== 'cancelled')
  if (opts?.onlyPending) items = items.filter((i) => i.status === 'pending')
  const blocks: ReceiptBlock[] = [
    { type: 'center', text: 'MUTFAK', bold: true, size: 'lg' },
    { type: 'row', left: order.tableName || 'Masa', right: nowStr(), size: 'sm' },
    { type: 'divider' },
  ]
  for (const it of items) {
    blocks.push({ type: 'left', text: `${it.quantity} x ${it.menuItemName}`, bold: true })
    if (it.note) blocks.push({ type: 'left', text: '  > ' + it.note, size: 'sm' })
  }
  if (items.length === 0) blocks.push({ type: 'center', text: '(ürün yok)', size: 'sm' })
  blocks.push({ type: 'divider' })
  if (order.note) blocks.push({ type: 'left', text: 'Masa notu: ' + order.note, size: 'sm' })
  return blocks
}
