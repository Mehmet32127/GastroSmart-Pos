const router   = require('express').Router()
const mongoose = require('mongoose')
const Order    = require('../models/Order')
const Settings = require('../models/Settings')
const { authenticate } = require('../middleware/auth')
const { ok, fail }     = require('../utils/response')

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount || 0)
}

function buildReceiptHTML(order, settings) {
  const items   = order.items.filter(i => i.status !== 'cancelled')
  const subtotal = order.subtotal ?? items.reduce((s, i) => s + i.total_price, 0)
  const taxTotal = order.tax_total ?? items.reduce((s, i) => s + (i.total_price * i.tax) / (100 + i.tax), 0)

  const discountAmount = order.discount_type === 'percent'
    ? subtotal * ((order.discount ?? 0) / 100)
    : (order.discount ?? 0)
  const total = order.total ?? (subtotal - discountAmount)

  const paymentLabel = {
    cash:          'Nakit',
    card:          'Kart',
    mixed:         'Nakit + Kart',
    complimentary: 'İkram',
  }[order.payment_method] || ''

  const now     = new Date(order.closed_at || order.createdAt || Date.now())
  const tz = { timeZone: 'Europe/Istanbul' }
  const dateStr = new Intl.DateTimeFormat('tr-TR', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(now)
  const timeStr = new Intl.DateTimeFormat('tr-TR', { ...tz, hour: '2-digit', minute: '2-digit' }).format(now)

  const restaurantName = escapeHtml(settings.restaurant_name || 'Restoranım')
  const address        = escapeHtml(settings.address || '')
  const phone          = escapeHtml(settings.phone  || '')
  const taxNo          = escapeHtml(settings.tax_no || '')
  const footer         = escapeHtml(settings.receipt_footer || 'Teşekkürler!')

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 80mm;
    padding: 4mm;
    color: #000;
  }
  .center  { text-align: center; }
  .bold    { font-weight: bold; }
  .large   { font-size: 15px; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  .row     { display: flex; justify-content: space-between; margin: 2px 0; }
  .row-left  { flex: 1; }
  .row-right { text-align: right; min-width: 60px; }
  .total-row { font-size: 14px; font-weight: bold; margin: 3px 0; }
  .muted     { color: #444; font-size: 11px; padding-left: 8px; }
  .footer    { text-align: center; margin-top: 6px; font-size: 11px; }
  @media print {
    body { width: 80mm; }
    @page { margin: 0; size: 80mm auto; }
  }
</style>
</head>
<body>
  <div class="center bold large">${restaurantName}</div>
  ${address ? `<div class="center">${address}</div>` : ''}
  ${phone   ? `<div class="center">Tel: ${phone}</div>` : ''}
  ${taxNo   ? `<div class="center">VKN: ${taxNo}</div>` : ''}

  <div class="divider"></div>

  <div class="row"><span>Tarih: ${dateStr} ${timeStr}</span></div>
  <div class="row">
    <span>Masa: ${escapeHtml(order.table_id?.name ?? '—')}</span>
    <span>Garson: ${escapeHtml(order.waiter_id?.full_name ?? '—')}</span>
  </div>
  <div class="row"><span>Adisyon No: #${String(order._id).slice(-6).toUpperCase()}</span></div>

  <div class="divider"></div>

  ${items.map(item => `
  <div class="row">
    <span class="row-left">${escapeHtml(item.menu_item_name)}</span>
    <span class="row-right">${formatCurrency(item.total_price)}</span>
  </div>
  <div class="muted">
    ${item.quantity} adet x ${formatCurrency(item.unit_price)}
    ${item.note ? `<br>Not: ${escapeHtml(item.note)}` : ''}
  </div>
  `).join('')}

  <div class="divider"></div>

  <div class="row">
    <span>Ara Toplam</span>
    <span>${formatCurrency(subtotal)}</span>
  </div>
  <div class="row">
    <span>KDV</span>
    <span>${formatCurrency(taxTotal)}</span>
  </div>
  ${discountAmount > 0 ? `
  <div class="row">
    <span>İndirim</span>
    <span>-${formatCurrency(discountAmount)}</span>
  </div>` : ''}

  <div class="divider"></div>

  <div class="row total-row">
    <span>TOPLAM</span>
    <span>${formatCurrency(total)}</span>
  </div>

  ${order.payment_method === 'cash' && order.change_amount > 0 ? `
  <div class="row">
    <span>Ödenen</span>
    <span>${formatCurrency(order.paid_amount)}</span>
  </div>
  <div class="row bold">
    <span>Para Üstü</span>
    <span>${formatCurrency(order.change_amount)}</span>
  </div>` : ''}

  ${order.payment_method === 'mixed' ? `
  <div class="row"><span>Nakit</span><span>${formatCurrency(order.cash_amount)}</span></div>
  <div class="row"><span>Kart</span><span>${formatCurrency(order.card_amount)}</span></div>` : ''}

  ${paymentLabel ? `<div class="row"><span>Ödeme</span><span>${escapeHtml(paymentLabel)}</span></div>` : ''}

  <div class="divider"></div>
  <div class="footer">${footer}</div>
  <div class="footer" style="margin-top:8px;">.</div>
</body>
</html>`
}

// ── GET /api/print/receipt/:orderId — JSON (fiş HTML içinde) ──────────────────
router.get('/receipt/:orderId', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      return fail(res, 'Geçersiz sipariş ID', 400)
    }

    const order = await Order.findById(req.params.orderId)
      .populate('table_id',  'name number')
      .populate('waiter_id', 'full_name')
      .lean()

    if (!order) return fail(res, 'Sipariş bulunamadı', 404)

    const docs     = await Settings.find({}).lean()
    const settings = Object.fromEntries(docs.map(d => [d.key, d.value]))
    const html     = buildReceiptHTML(order, settings)

    return ok(res, { html, orderId: order._id })
  } catch (err) { next(err) }
})

// ── GET /api/print/receipt/:orderId/raw — Direkt HTML (iframe için) ───────────
router.get('/receipt/:orderId/raw', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.orderId)) {
      return res.status(400).send('Geçersiz sipariş ID')
    }

    const order = await Order.findById(req.params.orderId)
      .populate('table_id',  'name number')
      .populate('waiter_id', 'full_name')
      .lean()

    if (!order) return res.status(404).send('Sipariş bulunamadı')

    const docs     = await Settings.find({}).lean()
    const settings = Object.fromEntries(docs.map(d => [d.key, d.value]))
    const html     = buildReceiptHTML(order, settings)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err) { next(err) }
})

module.exports = router
