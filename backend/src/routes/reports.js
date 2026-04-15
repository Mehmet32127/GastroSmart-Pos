const router = require('express').Router()
const { z } = require('zod')
const ExcelJS = require('exceljs')
const Order = require('../models/Order')
const MenuItem = require('../models/MenuItem')
const Reservation = require('../models/Reservation')
const CashClose = require('../models/CashClose')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')

const mgr = authorize('admin', 'manager')

// ── Helpers ───────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** YYYY-MM-DD formatını doğrula; geçersizse hata fırlat */
function validateDate(str, label) {
  if (!DATE_RE.test(str)) throw new Error(`${label} geçersiz format (YYYY-MM-DD bekleniyor)`)
  const d = new Date(str)
  if (isNaN(d.getTime())) throw new Error(`${label} geçersiz tarih`)
  return str
}

/** startDate ≤ endDate kontrolü */
function validateDateRange(startStr, endStr) {
  if (startStr > endStr) throw new Error('startDate, endDate\'den büyük olamaz')
}

// Türkiye UTC+3 (DST yok, 2016'dan beri sabit)
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000

function dayBounds(dateStr) {
  const start = new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - TZ_OFFSET_MS)
  const end   = new Date(new Date(`${dateStr}T23:59:59.999Z`).getTime() - TZ_OFFSET_MS)
  return { start, end }
}

function today() {
  // Istanbul saat dilimine göre bugünün tarihi (UTC değil)
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' }).format(new Date())
}

// ── GET /api/reports/daily-ciro ───────────────────────────────────────────────
router.get('/daily-ciro', authenticate, async (_req, res, next) => {
  try {
    const { start, end } = dayBounds(today())

    const [result] = await Order.aggregate([
      { $match: { status: 'closed', closed_at: { $gte: start, $lte: end } } },
      {
        $group: {
          _id:        null,
          total:      { $sum: '$total' },
          cash: { $sum: {
            $cond: [{ $eq: ['$payment_method', 'cash'] }, '$total',
              { $cond: [{ $eq: ['$payment_method', 'mixed'] }, { $ifNull: ['$cash_amount', 0] }, 0] }
            ]
          }},
          card: { $sum: {
            $cond: [{ $eq: ['$payment_method', 'card'] }, '$total',
              { $cond: [{ $eq: ['$payment_method', 'mixed'] }, { $ifNull: ['$card_amount', 0] }, 0] }
            ]
          }},
          orderCount: { $sum: 1 },
        },
      },
    ])

    return ok(res, {
      total:      result?.total      ?? 0,
      cash:       result?.cash       ?? 0,
      card:       result?.card       ?? 0,
      orderCount: result?.orderCount ?? 0,
    })
  } catch (err) { next(err) }
})

// ── GET /api/reports/daily ────────────────────────────────────────────────────
router.get('/daily', authenticate, mgr, async (req, res, next) => {
  try {
    const date = req.query.date ?? today()
    const { start, end } = dayBounds(date)

    const [summary] = await Order.aggregate([
      { $match: { status: 'closed', closed_at: { $gte: start, $lte: end } } },
      {
        $group: {
          _id:              null,
          totalRevenue:     { $sum: '$total' },
          totalOrders:      { $sum: 1 },
          cashRevenue: { $sum: {
            $cond: [{ $eq: ['$payment_method', 'cash'] }, '$total',
              { $cond: [{ $eq: ['$payment_method', 'mixed'] }, { $ifNull: ['$cash_amount', 0] }, 0] }
            ]
          }},
          cardRevenue: { $sum: {
            $cond: [{ $eq: ['$payment_method', 'card'] }, '$total',
              { $cond: [{ $eq: ['$payment_method', 'mixed'] }, { $ifNull: ['$card_amount', 0] }, 0] }
            ]
          }},
          averageOrderValue:{ $avg: '$total' },
        },
      },
    ])

    const topItems = await Order.aggregate([
      { $match: { status: 'closed', closed_at: { $gte: start, $lte: end } } },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id:     '$items.menu_item_id',
          name:    { $first: '$items.menu_item_name' },
          count:   { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total_price' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, menuItemId: { $toString: '$_id' }, name: 1, count: 1, revenue: 1 } },
    ])

    return ok(res, {
      date,
      totalRevenue:      summary?.totalRevenue      ?? 0,
      totalOrders:       summary?.totalOrders       ?? 0,
      cashRevenue:       summary?.cashRevenue       ?? 0,
      cardRevenue:       summary?.cardRevenue       ?? 0,
      averageOrderValue: summary?.averageOrderValue ?? 0,
      topItems,
    })
  } catch (err) { next(err) }
})

// ── GET /api/reports/weekly ───────────────────────────────────────────────────
router.get('/weekly', authenticate, mgr, async (req, res, next) => {
  try {
    const startDate = validateDate(
      req.query.startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
      'startDate',
    )
    const start = new Date(`${startDate}T00:00:00.000Z`)

    const rows = await Order.aggregate([
      { $match: { status: 'closed', closed_at: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$closed_at', timezone: 'Europe/Istanbul' },
          },
          totalRevenue:      { $sum: '$total' },
          totalOrders:       { $sum: 1 },
          cashRevenue: { $sum: {
            $cond: [{ $eq: ['$payment_method', 'cash'] }, '$total',
              { $cond: [{ $eq: ['$payment_method', 'mixed'] }, { $ifNull: ['$cash_amount', 0] }, 0] }
            ]
          }},
          averageOrderValue: { $avg: '$total' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0, date: '$_id',
          totalRevenue: 1, totalOrders: 1, cashRevenue: 1, averageOrderValue: 1,
        },
      },
    ])

    return ok(res, rows)
  } catch (err) { next(err) }
})

// ── GET /api/reports/hourly ───────────────────────────────────────────────────
router.get('/hourly', authenticate, mgr, async (req, res, next) => {
  try {
    const date = req.query.date ?? today()
    const { start, end } = dayBounds(date)

    const rows = await Order.aggregate([
      { $match: { status: 'closed', closed_at: { $gte: start, $lte: end } } },
      {
        $group: {
          _id:     { $hour: { date: '$closed_at', timezone: 'Europe/Istanbul' } },
          revenue: { $sum: '$total' },
          orders:  { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const hourMap = new Map(rows.map(r => [r._id, { revenue: r.revenue, orders: r.orders }]))
    const filled  = Array.from({ length: 24 }, (_, h) => ({
      hour:    h,
      revenue: hourMap.get(h)?.revenue ?? 0,
      orders:  hourMap.get(h)?.orders  ?? 0,
    }))

    return ok(res, filled)
  } catch (err) { next(err) }
})

// ── GET /api/reports/waiters ──────────────────────────────────────────────────
router.get('/waiters', authenticate, mgr, async (req, res, next) => {
  try {
    const match = { status: 'closed' }
    if (req.query.startDate) {
      validateDate(req.query.startDate, 'startDate')
      match.closed_at = { $gte: new Date(`${req.query.startDate}T00:00:00.000Z`) }
    }
    if (req.query.endDate) {
      validateDate(req.query.endDate, 'endDate')
      match.closed_at = { ...match.closed_at, $lte: new Date(`${req.query.endDate}T23:59:59.999Z`) }
    }
    if (req.query.startDate && req.query.endDate) validateDateRange(req.query.startDate, req.query.endDate)

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id:              '$waiter_id',
          totalOrders:      { $sum: 1 },
          totalRevenue:     { $sum: '$total' },
          averageOrderValue:{ $avg: '$total' },
          avgServiceMs:     {
            $avg: {
              $subtract: ['$closed_at', '$createdAt'],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users', localField: '_id', foreignField: '_id', as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id:              0,
          waiterId:         '$_id',
          waiterName:       '$user.full_name',
          totalOrders:      1,
          totalRevenue:     1,
          averageOrderValue:1,
          avgServiceTime:   { $divide: ['$avgServiceMs', 60000] },  // minutes
        },
      },
      { $sort: { totalRevenue: -1 } },
    ])

    return ok(res, rows)
  } catch (err) { next(err) }
})

// ── GET /api/reports/top-items ────────────────────────────────────────────────
router.get('/top-items', authenticate, mgr, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit ?? '10')), 500)
    const match = { status: 'closed' }
    if (req.query.startDate) {
      validateDate(req.query.startDate, 'startDate')
      match.closed_at = { $gte: new Date(`${req.query.startDate}T00:00:00.000Z`) }
    }
    if (req.query.endDate) {
      validateDate(req.query.endDate, 'endDate')
      match.closed_at = { ...match.closed_at, $lte: new Date(`${req.query.endDate}T23:59:59.999Z`) }
    }
    if (req.query.startDate && req.query.endDate) validateDateRange(req.query.startDate, req.query.endDate)

    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $match: { 'items.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id:     '$items.menu_item_id',
          name:    { $first: '$items.menu_item_name' },
          count:   { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total_price' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, id: '$_id', name: 1, count: 1, revenue: 1 } },
    ])

    return ok(res, rows)
  } catch (err) { next(err) }
})

// ── POST /api/reports/cash-close ──────────────────────────────────────────────
router.post('/cash-close', authenticate, mgr, async (req, res, next) => {
  try {
    const schema = z.object({
      banknotes: z.record(z.string(), z.coerce.number()),
      note:      z.string().optional(),
    })
    const { banknotes, note } = schema.parse(req.body)

    const cashTotal = Object.entries(banknotes).reduce(
      (sum, [val, count]) => sum + parseFloat(val) * count,
      0
    )

    const { start, end } = dayBounds(today())
    const [result] = await Order.aggregate([
      {
        $match: {
          status:         'closed',
          payment_method: { $in: ['cash', 'mixed'] },
          closed_at:      { $gte: start, $lte: end },
        },
      },
      { $group: { _id: null, total: { $sum: '$cash_amount' } } },
    ])
    const expectedTotal = result?.total ?? 0
    const difference    = cashTotal - expectedTotal

    const record = await CashClose.create({
      cash_total:     cashTotal,
      expected_total: expectedTotal,
      difference,
      banknotes,
      note,
      closed_by: req.user.id,
    })

    return ok(res, {
      id:            record._id,
      cashTotal,
      expectedTotal,
      difference,
    }, 'Kasa kapatıldı')
  } catch (err) { next(err) }
})

// ── GET /api/reports/cash-history ─────────────────────────────────────────────
router.get('/cash-history', authenticate, mgr, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit ?? '10')
    const rows  = await CashClose.find()
      .populate('closed_by', 'full_name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    return ok(res, rows.map(r => ({
      id:            r._id,
      cashTotal:     r.cash_total,
      expectedTotal: r.expected_total,
      difference:    r.difference,
      banknotes:     r.banknotes,
      note:          r.note ?? null,
      closedAt:      r.createdAt,
      closedByName:  r.closed_by?.full_name ?? null,
    })))
  } catch (err) { next(err) }
})

// ── Excel helpers ─────────────────────────────────────────────────────────────

const BRAND_COLOR  = 'FFF59E0B'   // amber-400
const BRAND_DARK   = 'FF1A1D27'   // dark bg
const ROW_EVEN     = 'FFF9FAFB'   // very light grey
const ROW_ODD      = 'FFFFFFFF'
const DANGER_FILL  = 'FFFEE2E2'   // light red
const WARN_FILL    = 'FFFEF3C7'   // light amber
const TZ_ISTANBUL  = 'Europe/Istanbul'

function fmtTR(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ_ISTANBUL,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

function fmtDateTR(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ_ISTANBUL, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(date))
}

function fmtTimeTR(date) {
  if (!date) return ''
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ_ISTANBUL, hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

function applyHeaderRow(sheet, fillArgb = BRAND_COLOR) {
  const row = sheet.getRow(1)
  row.height = 22
  row.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FFD97706' } } }
  })
}

function applyDataRows(sheet, startRow = 2) {
  for (let i = startRow; i <= sheet.rowCount; i++) {
    const row  = sheet.getRow(i)
    const fill = i % 2 === 0 ? ROW_EVEN : ROW_ODD
    row.eachCell({ includeEmpty: false }, cell => {
      if (!cell.fill || cell.fill.fgColor?.argb === undefined) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      }
      cell.border = {
        top:    { style: 'hair', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        left:   { style: 'hair', color: { argb: 'FFE5E7EB' } },
        right:  { style: 'hair', color: { argb: 'FFE5E7EB' } },
      }
      cell.alignment = { ...cell.alignment, vertical: 'middle' }
    })
    row.height = 18
  }
}

function addSummaryBlock(sheet, items, startRow) {
  let r = startRow + 1
  items.forEach(([label, value, numFmt]) => {
    const row  = sheet.getRow(r++)
    const labelCell = row.getCell(1)
    const valueCell = row.getCell(2)
    labelCell.value = label
    valueCell.value = value
    if (numFmt) valueCell.numFmt = numFmt
    labelCell.font = { bold: true, size: 10 }
    valueCell.font = { size: 10 }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  })
}

const PAYMENT_LABELS = { cash: 'Nakit', card: 'Kart', mixed: 'Nakit+Kart', complimentary: 'İkram' }

// ── GET /api/reports/export/:type ─────────────────────────────────────────────
router.get('/export/:type', authenticate, mgr, async (req, res, next) => {
  try {
    const { type }   = req.params
    const workbook   = new ExcelJS.Workbook()
    workbook.creator = 'GastroSmart POS'
    workbook.created = new Date()

    // ── DAILY ────────────────────────────────────────────────────────────────
    if (type === 'daily') {
      const date = req.query.date ?? today()
      const { start, end } = dayBounds(date)

      const orders = await Order.find({ status: 'closed', closed_at: { $gte: start, $lte: end } })
        .populate('table_id',  'name')
        .populate('waiter_id', 'full_name')
        .lean()

      // ── Sheet 1: Özet
      const sumSheet = workbook.addWorksheet('Özet')
      sumSheet.columns = [
        { key: 'label', width: 28 },
        { key: 'value', width: 20 },
      ]
      sumSheet.getRow(1).values = ['GastroSmart POS — Günlük Rapor', date]
      sumSheet.getRow(1).font  = { bold: true, size: 13, color: { argb: BRAND_DARK } }
      sumSheet.getRow(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_COLOR } }
      sumSheet.getRow(1).height = 26
      sumSheet.getRow(1).eachCell(c => { c.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } } })

      const totalRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0)
      const cashRevenue  = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total ?? 0), 0)
      const cardRevenue  = orders.filter(o => o.payment_method === 'card').reduce((s, o) => s + (o.total ?? 0), 0)
      const mixedRevenue = orders.filter(o => o.payment_method === 'mixed').reduce((s, o) => s + (o.total ?? 0), 0)
      const avgOrder     = orders.length ? totalRevenue / orders.length : 0

      addSummaryBlock(sumSheet, [
        ['Toplam Sipariş',     orders.length,    null],
        ['Toplam Ciro (₺)',    totalRevenue,     '#,##0.00 ₺'],
        ['Nakit Ciro (₺)',     cashRevenue,      '#,##0.00 ₺'],
        ['Kart Ciro (₺)',      cardRevenue,      '#,##0.00 ₺'],
        ['Karma Ciro (₺)',     mixedRevenue,     '#,##0.00 ₺'],
        ['Ortalama Adisyon (₺)', avgOrder,       '#,##0.00 ₺'],
        ['Rapor Tarihi',       fmtDateTR(new Date()), null],
      ], 1)

      // ── Sheet 2: Siparişler
      const ordSheet = workbook.addWorksheet('Siparişler')
      ordSheet.columns = [
        { header: '#',            key: 'no',      width: 6 },
        { header: 'Masa',         key: 'table',   width: 14 },
        { header: 'Garson',       key: 'waiter',  width: 20 },
        { header: 'Ürün Sayısı',  key: 'items',   width: 12 },
        { header: 'Ara Toplam',   key: 'sub',     width: 14 },
        { header: 'İndirim',      key: 'disc',    width: 12 },
        { header: 'Toplam (₺)',   key: 'total',   width: 14 },
        { header: 'Ödeme',        key: 'payment', width: 14 },
        { header: 'Açılış',       key: 'opened',  width: 18 },
        { header: 'Kapanış',      key: 'closed',  width: 18 },
      ]
      applyHeaderRow(ordSheet)
      orders.forEach((o, idx) => {
        const row = ordSheet.addRow({
          no:      idx + 1,
          table:   o.table_id?.name         ?? '—',
          waiter:  o.waiter_id?.full_name   ?? '—',
          items:   o.items?.length          ?? 0,
          sub:     o.subtotal               ?? 0,
          disc:    o.discount               ?? 0,
          total:   o.total                  ?? 0,
          payment: PAYMENT_LABELS[o.payment_method] ?? (o.payment_method ?? '—'),
          opened:  fmtTR(o.createdAt),
          closed:  fmtTR(o.closed_at),
        })
        ;['sub','disc','total'].forEach(k => {
          const cell = row.getCell(k)
          cell.numFmt = '#,##0.00'
        })
      })
      applyDataRows(ordSheet)

      // Summary footer
      const totalRow = ordSheet.addRow({ table: 'TOPLAM', total: totalRevenue })
      totalRow.font = { bold: true }
      totalRow.getCell('total').numFmt = '#,##0.00'

      // ── Sheet 3: Ürün Detayı
      const itemSheet = workbook.addWorksheet('Ürün Detayı')
      itemSheet.columns = [
        { header: 'Ürün Adı',    key: 'name',    width: 30 },
        { header: 'Adet',        key: 'qty',     width: 8  },
        { header: 'Birim Fiyat', key: 'unit',    width: 14 },
        { header: 'Toplam',      key: 'total',   width: 14 },
        { header: 'KDV (%)',     key: 'tax',     width: 10 },
        { header: 'Masa',        key: 'table',   width: 14 },
        { header: 'Garson',      key: 'waiter',  width: 20 },
        { header: 'Saat',        key: 'time',    width: 18 },
      ]
      applyHeaderRow(itemSheet)
      for (const o of orders) {
        for (const item of (o.items ?? [])) {
          if (item.status === 'cancelled') continue
          const row = itemSheet.addRow({
            name:   item.menu_item_name,
            qty:    item.quantity,
            unit:   item.unit_price,
            total:  item.total_price,
            tax:    item.tax ?? 0,
            table:  o.table_id?.name       ?? '—',
            waiter: o.waiter_id?.full_name ?? '—',
            time:   fmtTR(o.closed_at),
          })
          ;['unit','total'].forEach(k => { row.getCell(k).numFmt = '#,##0.00' })
        }
      }
      applyDataRows(itemSheet)
    }

    // ── WEEKLY ───────────────────────────────────────────────────────────────
    if (type === 'weekly') {
      const endDate   = req.query.endDate   ?? today()
      const startDate = req.query.startDate ??
        new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const { start } = dayBounds(startDate)
      const { end }   = dayBounds(endDate)

      const sheet = workbook.addWorksheet('Haftalık Rapor')
      sheet.columns = [
        { header: 'Tarih',           key: 'date',    width: 14 },
        { header: 'Sipariş Sayısı',  key: 'orders',  width: 14 },
        { header: 'Toplam Ciro (₺)', key: 'revenue', width: 18 },
        { header: 'Nakit (₺)',       key: 'cash',    width: 14 },
        { header: 'Kart (₺)',        key: 'card',    width: 14 },
        { header: 'Ortalama (₺)',    key: 'avg',     width: 14 },
      ]
      applyHeaderRow(sheet)

      const rows = await Order.aggregate([
        { $match: { status: 'closed', closed_at: { $gte: start, $lte: end } } },
        {
          $group: {
            _id:     { $dateToString: { format: '%Y-%m-%d', date: '$closed_at', timezone: TZ_ISTANBUL } },
            orders:  { $sum: 1 },
            revenue: { $sum: '$total' },
            cash:    { $sum: { $cond: [{ $eq: ['$payment_method', 'cash'] }, '$total', 0] } },
            card:    { $sum: { $cond: [{ $eq: ['$payment_method', 'card'] }, '$total', 0] } },
            avg:     { $avg: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ])

      let totalRevenue = 0, totalOrders = 0
      rows.forEach(r => {
        totalRevenue += r.revenue
        totalOrders  += r.orders
        const row = sheet.addRow({
          date:    r._id, orders: r.orders,
          revenue: r.revenue, cash: r.cash, card: r.card, avg: r.avg,
        })
        ;['revenue','cash','card','avg'].forEach(k => { row.getCell(k).numFmt = '#,##0.00' })
      })
      applyDataRows(sheet)

      const footRow = sheet.addRow({ date: 'TOPLAM', orders: totalOrders, revenue: totalRevenue })
      footRow.font = { bold: true }
      footRow.getCell('revenue').numFmt = '#,##0.00'
    }

    // ── WAITERS ───────────────────────────────────────────────────────────────
    if (type === 'waiters') {
      const sheet = workbook.addWorksheet('Garson Performansı')
      sheet.columns = [
        { header: 'Garson',              key: 'name',     width: 26 },
        { header: 'Sipariş',             key: 'orders',   width: 10 },
        { header: 'Toplam Ciro (₺)',     key: 'revenue',  width: 18 },
        { header: 'Nakit (₺)',           key: 'cash',     width: 14 },
        { header: 'Kart (₺)',            key: 'card',     width: 14 },
        { header: 'Ortalama Adisyon (₺)',key: 'avg',      width: 20 },
        { header: 'Ort. Servis (dk)',     key: 'svc',      width: 16 },
      ]
      applyHeaderRow(sheet)

      const rows = await Order.aggregate([
        { $match: { status: 'closed' } },
        {
          $group: {
            _id:     '$waiter_id',
            orders:  { $sum: 1 },
            revenue: { $sum: '$total' },
            cash:    { $sum: { $cond: [{ $eq: ['$payment_method', 'cash'] }, '$total', 0] } },
            card:    { $sum: { $cond: [{ $eq: ['$payment_method', 'card'] }, '$total', 0] } },
            avg:     { $avg: '$total' },
            svcMs:   { $avg: { $subtract: ['$closed_at', '$createdAt'] } },
          },
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $sort: { revenue: -1 } },
      ])

      rows.forEach(r => {
        const row = sheet.addRow({
          name:    r.u?.full_name ?? '?',
          orders:  r.orders,
          revenue: r.revenue,
          cash:    r.cash,
          card:    r.card,
          avg:     r.avg,
          svc:     r.svcMs ? Math.round(r.svcMs / 60000) : 0,
        })
        ;['revenue','cash','card','avg'].forEach(k => { row.getCell(k).numFmt = '#,##0.00' })
      })
      applyDataRows(sheet)
    }

    // ── STOCK ─────────────────────────────────────────────────────────────────
    if (type === 'stock') {
      const sheet = workbook.addWorksheet('Stok Durumu')
      sheet.columns = [
        { header: 'Ürün',         key: 'name',   width: 32 },
        { header: 'Kategori',     key: 'cat',    width: 22 },
        { header: 'Fiyat (₺)',    key: 'price',  width: 12 },
        { header: 'Mevcut Stok',  key: 'stock',  width: 14 },
        { header: 'Min. Stok',    key: 'min',    width: 12 },
        { header: 'Birim',        key: 'unit',   width: 10 },
        { header: 'Durum',        key: 'status', width: 14 },
      ]
      applyHeaderRow(sheet)

      const items = await MenuItem.find({ stock_quantity: { $ne: null } })
        .populate('category_id', 'name')
        .lean()

      items.sort((a, b) => {
        const sa = (a.stock_quantity ?? 0) <= 0 ? 0 : (a.stock_quantity ?? 0) <= (a.min_stock ?? 0) ? 1 : 2
        const sb = (b.stock_quantity ?? 0) <= 0 ? 0 : (b.stock_quantity ?? 0) <= (b.min_stock ?? 0) ? 1 : 2
        return sa - sb
      })

      items.forEach(i => {
        const qty    = i.stock_quantity ?? 0
        const minQ   = i.min_stock ?? 0
        const status = qty <= 0 ? 'Tükendi' : qty <= minQ ? 'Düşük' : 'Normal'
        const row    = sheet.addRow({
          name:   i.name,
          cat:    i.category_id?.name ?? '',
          price:  i.price ?? 0,
          stock:  qty,
          min:    minQ,
          unit:   i.unit ?? 'adet',
          status,
        })
        row.getCell('price').numFmt = '#,##0.00'
        if (status === 'Tükendi') {
          row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DANGER_FILL } } })
          row.getCell('status').font = { bold: true, color: { argb: 'FFDC2626' } }
        } else if (status === 'Düşük') {
          row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_FILL } } })
          row.getCell('status').font = { bold: true, color: { argb: 'FFD97706' } }
        }
      })
      applyDataRows(sheet, 2)  // preserves conditional fills
    }

    // ── RESERVATIONS ──────────────────────────────────────────────────────────
    if (type === 'reservations') {
      const sheet = workbook.addWorksheet('Rezervasyonlar')
      sheet.columns = [
        { header: 'Müşteri',     key: 'name',    width: 26 },
        { header: 'Telefon',     key: 'phone',   width: 18 },
        { header: 'Tarih',       key: 'date',    width: 14 },
        { header: 'Saat',        key: 'time',    width: 10 },
        { header: 'Kişi',        key: 'guests',  width: 8  },
        { header: 'Durum',       key: 'status',  width: 16 },
        { header: 'Kapora (₺)', key: 'deposit', width: 14 },
        { header: 'Not',         key: 'note',    width: 30 },
      ]
      applyHeaderRow(sheet)

      const rsvs = await Reservation.find().sort({ reservation_time: -1 }).lean()
      rsvs.forEach(r => {
        const row = sheet.addRow({
          name:    r.guest_name,
          phone:   r.guest_phone,
          date:    fmtDateTR(r.reservation_time),
          time:    fmtTimeTR(r.reservation_time),
          guests:  r.party_size,
          status:  r.status,
          deposit: r.deposit ?? 0,
          note:    r.notes ?? '',
        })
        row.getCell('deposit').numFmt = '#,##0.00'
      })
      applyDataRows(sheet)
    }

    if (!workbook.worksheets.length) {
      return fail(res, 'Geçersiz rapor tipi', 400)
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="gastrosmart-${type}-${today()}.xlsx"`)
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) { next(err) }
})

module.exports = router
