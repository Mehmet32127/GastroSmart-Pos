const router = require('express').Router()
const { z } = require('zod')
const mongoose = require('mongoose')
const Reservation = require('../models/Reservation')
const Table = require('../models/Table')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const logger = require('../utils/logger')

// ── Formatter ─────────────────────────────────────────────────────────────────

// Yerel saat dilimi (sunucu Windows'ta Türkiye saati ile çalışıyor)
// Date metotları (getHours, getDate vb.) yerel saati döndürür — toISOString() değil
function localDate(d) {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function localTime(d) {
  const h   = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

function fmtReservation(r) {
  return {
    id:              r._id.toString(),
    tableId:         r.table_id?._id?.toString() ?? r.table_id?.toString() ?? null,
    tableName:       r.table_id?.name ?? null,
    customerName:    r.guest_name,
    customerPhone:   r.guest_phone,
    customerEmail:   r.guest_email ?? null,
    guestCount:      r.party_size,
    date:            r.reservation_time ? localDate(r.reservation_time) : null,
    time:            r.reservation_time ? localTime(r.reservation_time) : null,
    endTime:         r.end_time ? localTime(r.end_time) : null,
    durationMin:     r.duration_minutes ?? 120,
    status:          r.status,
    deposit:         r.deposit ?? 0,
    depositPaid:     r.deposit_paid ?? false,
    depositRefunded: r.deposit_refunded ?? false,
    note:            r.notes ?? null,
    createdAt:       r.createdAt,
    updatedAt:       r.updatedAt,
  }
}

// ── GET /api/reservations ─────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { date, status, tableId } = req.query
    const filter = {}

    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      filter.reservation_time = { $gte: start, $lte: end }
    }
    if (status)  filter.status   = status
    if (tableId && mongoose.isValidObjectId(tableId)) filter.table_id = tableId

    const reservations = await Reservation.find(filter)
      .populate('table_id', 'name number')
      .sort({ reservation_time: 1 })
      .lean()

    return ok(res, reservations.map(fmtReservation))
  } catch (err) { next(err) }
})

// ── GET /api/reservations/:id ─────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const r = await Reservation.findById(req.params.id).populate('table_id', 'name number').lean()
    if (!r) return fail(res, 'Rezervasyon bulunamadı', 404)
    return ok(res, fmtReservation(r))
  } catch (err) { next(err) }
})

// ── POST /api/reservations ────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      customerName:  z.string().min(2),
      customerPhone: z.string().min(7),
      customerEmail: z.string().email().optional().or(z.literal('')),
      guestCount:    z.coerce.number().int().positive(),
      date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time:          z.string().regex(/^\d{2}:\d{2}$/),
      endTime:       z.string().regex(/^\d{2}:\d{2}$/).optional(),
      durationMin:   z.coerce.number().int().positive().optional(),
      tableId:       z.string().optional(),
      deposit:       z.coerce.number().min(0).default(0),
      note:          z.string().optional(),
    })
    const data = schema.parse(req.body)

    const reservationTime = new Date(`${data.date}T${data.time}:00`)
    if (isNaN(reservationTime.getTime())) return fail(res, 'Geçersiz tarih/saat', 400)

    // endTime verilmişse durationMin'i hesapla, yoksa default 120 dk
    let durationMin = data.durationMin ?? 120
    if (data.endTime) {
      const endDate = new Date(`${data.date}T${data.endTime}:00`)
      const diff = Math.round((endDate.getTime() - reservationTime.getTime()) / 60000)
      if (diff > 0) durationMin = diff
    }

    if (data.tableId) {
      if (!mongoose.isValidObjectId(data.tableId)) return fail(res, 'Geçersiz masa ID', 400)
      const table = await Table.findById(data.tableId)
      if (!table) return fail(res, 'Masa bulunamadı', 404)
    }

    const reservation = await Reservation.create({
      table_id:         data.tableId || null,
      guest_name:       data.customerName,
      guest_phone:      data.customerPhone,
      guest_email:      data.customerEmail || undefined,
      party_size:       data.guestCount,
      reservation_time: reservationTime,
      duration_minutes: durationMin,
      notes:            data.note,
      deposit:          data.deposit,
      status:           'pending',
      created_by:       req.user.id,
    })

    const populated = await Reservation.findById(reservation._id).populate('table_id', 'name number').lean()
    logger.info(`✅ Rezervasyon oluşturuldu: ${reservation.guest_name}`)
    return ok(res, fmtReservation(populated), 'Rezervasyon oluşturuldu', 201)
  } catch (err) { next(err) }
})

// ── PUT /api/reservations/:id ─────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      customerName:  z.string().min(2).optional(),
      customerPhone: z.string().min(7).optional(),
      customerEmail: z.string().email().optional().or(z.literal('')),
      guestCount:    z.coerce.number().int().positive().optional(),
      date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      time:          z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime:       z.string().regex(/^\d{2}:\d{2}$/).optional(),
      durationMin:   z.coerce.number().int().positive().optional(),
      tableId:       z.string().nullable().optional(),
      deposit:       z.coerce.number().min(0).optional(),
      note:          z.string().optional(),
    })
    const data = schema.parse(req.body)

    const reservation = await Reservation.findById(req.params.id)
    if (!reservation) return fail(res, 'Rezervasyon bulunamadı', 404)

    if (data.customerName  !== undefined) reservation.guest_name  = data.customerName
    if (data.customerPhone !== undefined) reservation.guest_phone = data.customerPhone
    if (data.customerEmail !== undefined) reservation.guest_email = data.customerEmail || undefined
    if (data.guestCount    !== undefined) reservation.party_size  = data.guestCount
    if (data.note          !== undefined) reservation.notes       = data.note
    if (data.deposit       !== undefined) reservation.deposit     = data.deposit
    if (data.tableId       !== undefined) reservation.table_id    = data.tableId || null

    // Tarih/saat güncellemesi — toISOString() UTC döndüreceği için yerel saat metodları kullan
    if (data.date || data.time) {
      const d = data.date ?? localDate(reservation.reservation_time)
      const t = data.time ?? localTime(reservation.reservation_time)
      reservation.reservation_time = new Date(`${d}T${t}:00`)
    }

    // endTime → durationMin hesapla
    if (data.endTime) {
      const baseDate = data.date ?? localDate(reservation.reservation_time)
      const startTime = data.time ?? localTime(reservation.reservation_time)
      const start = new Date(`${baseDate}T${startTime}:00`)
      const end   = new Date(`${baseDate}T${data.endTime}:00`)
      const diff  = Math.round((end.getTime() - start.getTime()) / 60000)
      if (diff > 0) reservation.duration_minutes = diff
    } else if (data.durationMin !== undefined) {
      reservation.duration_minutes = data.durationMin
    }

    await reservation.save()
    const populated = await Reservation.findById(reservation._id).populate('table_id', 'name number').lean()
    return ok(res, fmtReservation(populated))
  } catch (err) { next(err) }
})

// ── PATCH /api/reservations/:id/status ───────────────────────────────────────
router.patch('/:id/status', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      status:          z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled']),
      depositPaid:     z.boolean().optional(),
      depositRefunded: z.boolean().optional(),
    })
    const data = schema.parse(req.body)

    const update = { status: data.status }
    if (data.depositPaid     !== undefined) update.deposit_paid     = data.depositPaid
    if (data.depositRefunded !== undefined) update.deposit_refunded = data.depositRefunded

    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('table_id', 'name number').lean()

    if (!reservation) return fail(res, 'Rezervasyon bulunamadı', 404)

    logger.info(`✅ Rezervasyon durumu: ${reservation.guest_name} → ${data.status}`)
    return ok(res, fmtReservation(reservation))
  } catch (err) { next(err) }
})

// ── POST /api/reservations/:id/refund — Deposit iade ───────────────────────���─
router.post('/:id/refund', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
    if (!reservation) return fail(res, 'Rezervasyon bulunamadı', 404)
    if (!reservation.deposit_paid) return fail(res, 'Önce depozito tahsil edilmeli', 400)
    if (reservation.deposit_refunded) return fail(res, 'Depozito zaten iade edildi', 409)

    reservation.deposit_refunded = true
    await reservation.save()

    const populated = await Reservation.findById(reservation._id).populate('table_id', 'name number').lean()
    logger.info(`✅ Depozito iade edildi: ${reservation.guest_name}`)
    return ok(res, fmtReservation(populated), 'Depozito iade edildi')
  } catch (err) { next(err) }
})

// ── DELETE /api/reservations/:id ──────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const r = await Reservation.findByIdAndDelete(req.params.id)
    if (!r) return fail(res, 'Rezervasyon bulunamadı', 404)
    logger.info(`✅ Rezervasyon silindi: ${r.guest_name}`)
    return ok(res, null, 'Rezervasyon silindi')
  } catch (err) { next(err) }
})

module.exports = router
