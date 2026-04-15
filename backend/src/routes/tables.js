const router = require('express').Router()
const { z } = require('zod')
const mongoose = require('mongoose')
const Table = require('../models/Table')
const Order = require('../models/Order')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const logger = require('../utils/logger')

// ── Helper ────────────────────────────────────────────────────────────────────

async function enrichTable(table) {
  const order = await Order.findOne({ table_id: table._id, status: 'open' })
    .select('_id total waiter_id createdAt')
    .populate('waiter_id', 'full_name')
    .lean()

  return {
    id:               table._id.toString(),
    number:           table.number,
    name:             table.name,
    capacity:         table.capacity,
    status:           table.status,
    section:          table.section ?? null,
    currentOrderId:   order?._id?.toString() ?? null,
    activeOrderTotal: order?.total ?? null,
    waiterId:         order?.waiter_id?._id?.toString() ?? null,
    waiterName:       order?.waiter_id?.full_name ?? null,
    openedAt:         order?.createdAt ?? null,
  }
}

// ── GET /api/tables ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const tables = await Table.find().sort({ number: 1 }).lean()
    const enriched = await Promise.all(tables.map(enrichTable))
    return ok(res, enriched)
  } catch (err) { next(err) }
})

// ── GET /api/tables/:id ───────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'Geçersiz masa ID', 400)
    const table = await Table.findById(req.params.id).lean()
    if (!table) return fail(res, 'Masa bulunamadı', 404)
    return ok(res, await enrichTable(table))
  } catch (err) { next(err) }
})

// ── POST /api/tables ──────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      number:   z.coerce.number().int().positive(),
      name:     z.string().min(1),
      capacity: z.coerce.number().int().positive().default(4),
      section:  z.string().optional(),
    })
    const data = schema.parse(req.body)

    const exists = await Table.findOne({ number: data.number })
    if (exists) return fail(res, 'Bu masa numarası zaten kullanılıyor', 409)

    const table = await Table.create({ ...data, status: 'available' })
    logger.info(`✅ Masa oluşturuldu: ${table.name}`)
    return ok(res, await enrichTable(table.toObject()), 'Masa oluşturuldu', 201)
  } catch (err) { next(err) }
})

// ── PUT /api/tables/:id ───────────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'Geçersiz masa ID', 400)
    const schema = z.object({
      number:   z.coerce.number().int().positive().optional(),
      name:     z.string().min(1).optional(),
      capacity: z.coerce.number().int().positive().optional(),
      section:  z.string().optional(),
    })
    const data = schema.parse(req.body)

    const table = await Table.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).lean()
    if (!table) return fail(res, 'Masa bulunamadı', 404)

    logger.info(`✅ Masa güncellendi: ${table.name}`)
    return ok(res, await enrichTable(table))
  } catch (err) { next(err) }
})

// ── PATCH /api/tables/:id/status ─────────────────────────────────────────────
router.patch('/:id/status', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'Geçersiz masa ID', 400)
    const schema = z.object({
      status: z.enum(['available', 'occupied', 'reserved', 'cleaning']),
    })
    const { status } = schema.parse(req.body)

    const table = await Table.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean()
    if (!table) return fail(res, 'Masa bulunamadı', 404)

    const enriched = await enrichTable(table)
    req.io?.emit('table:updated', enriched)

    logger.info(`✅ Masa durumu: ${table.name} → ${status}`)
    return ok(res, enriched)
  } catch (err) { next(err) }
})

// ── DELETE /api/tables/:id ────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'Geçersiz masa ID', 400)
    const table = await Table.findById(req.params.id)
    if (!table) return fail(res, 'Masa bulunamadı', 404)

    const openOrder = await Order.findOne({ table_id: req.params.id, status: 'open' })
    if (openOrder) return fail(res, 'Açık siparişi olan masa silinemez', 409)

    await table.deleteOne()
    logger.info(`✅ Masa silindi: ${table.name}`)
    return ok(res, null, 'Masa silindi')
  } catch (err) { next(err) }
})

// ── POST /api/tables/merge — İki masayı birleştir ────────────────────────────
// Kaynak masanın tüm sipariş kalemleri hedef masanın siparişine taşınır.
// Not: /merge, Express'te /:id'den önce tanımlanmalı (literal route önce gelir).
router.post('/merge', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      sourceTableId: z.string().min(1),
      targetTableId: z.string().min(1),
    })
    const { sourceTableId, targetTableId } = schema.parse(req.body)

    if (!mongoose.isValidObjectId(sourceTableId)) return fail(res, 'Geçersiz kaynak masa ID', 400)
    if (!mongoose.isValidObjectId(targetTableId)) return fail(res, 'Geçersiz hedef masa ID', 400)
    if (sourceTableId === targetTableId) return fail(res, 'Kaynak ve hedef masa aynı olamaz', 400)

    const [sourceTable, targetTable] = await Promise.all([
      Table.findById(sourceTableId),
      Table.findById(targetTableId),
    ])
    if (!sourceTable) return fail(res, 'Kaynak masa bulunamadı', 404)
    if (!targetTable) return fail(res, 'Hedef masa bulunamadı', 404)

    const sourceOrder = await Order.findOne({ table_id: sourceTableId, status: 'open' })
    if (!sourceOrder) return fail(res, 'Kaynak masada açık sipariş yok', 404)

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      let targetOrder = await Order.findOne({ table_id: targetTableId, status: 'open' }).session(session)

      if (targetOrder) {
        // Kaynak kalemleri hedef siparişe ekle
        // _id çıkarılıyor: toObject() kaynak _id'yi korur, bu hedef siparişte
        // aynı subdocument _id'lerin oluşmasına yol açar.
        for (const item of sourceOrder.items) {
          const { _id, ...itemData } = item.toObject ? item.toObject() : item
          targetOrder.items.push(itemData)
        }
        targetOrder.recalculate()
        await targetOrder.save({ session })
      } else {
        // Hedef masada sipariş yoksa, kaynak siparişi hedef masaya taşı
        sourceOrder.table_id = targetTableId
        await sourceOrder.save({ session })
        targetOrder = sourceOrder
      }

      // Kaynak siparişi boşalt ve void yap (targetOrder !== sourceOrder ise)
      if (targetOrder._id.toString() !== sourceOrder._id.toString()) {
        sourceOrder.status    = 'voided'
        sourceOrder.closed_at = new Date()
        await sourceOrder.save({ session })
      }

      sourceTable.status = 'available'
      targetTable.status = 'occupied'
      await Promise.all([
        sourceTable.save({ session }),
        targetTable.save({ session }),
      ])

      await session.commitTransaction()

      const [enrichedSource, enrichedTarget] = await Promise.all([
        enrichTable(sourceTable.toObject()),
        enrichTable(targetTable.toObject()),
      ])
      req.io?.emit('table:updated', enrichedSource)
      req.io?.emit('table:updated', enrichedTarget)

      logger.info(`✅ Masa birleştirildi: ${sourceTable.name} → ${targetTable.name}`)
      return ok(res, { sourceTable: enrichedSource, targetTable: enrichedTarget }, 'Masalar birleştirildi')
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }
  } catch (err) { next(err) }
})

// ── POST /api/tables/transfer — Siparişi başka masaya taşı ───────────────────
router.post('/transfer', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      fromTableId: z.string().min(1),
      toTableId:   z.string().min(1),
    })
    const { fromTableId, toTableId } = schema.parse(req.body)

    if (!mongoose.isValidObjectId(fromTableId)) return fail(res, 'Geçersiz kaynak masa ID', 400)
    if (!mongoose.isValidObjectId(toTableId))   return fail(res, 'Geçersiz hedef masa ID', 400)
    if (fromTableId === toTableId) return fail(res, 'Kaynak ve hedef masa aynı olamaz', 400)

    const [fromTable, toTable] = await Promise.all([
      Table.findById(fromTableId),
      Table.findById(toTableId),
    ])
    if (!fromTable) return fail(res, 'Kaynak masa bulunamadı', 404)
    if (!toTable)   return fail(res, 'Hedef masa bulunamadı', 404)
    if (toTable.status !== 'available') return fail(res, 'Hedef masa boş değil', 409)

    const openOrderCount = await Order.countDocuments({ table_id: fromTableId, status: 'open' })
    if (openOrderCount === 0) return fail(res, 'Kaynak masada açık sipariş bulunmuyor', 400)

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      await Order.updateMany(
        { table_id: fromTableId, status: 'open' },
        { $set: { table_id: toTableId } },
        { session }
      )
      fromTable.status = 'available'
      toTable.status   = 'occupied'
      await Promise.all([
        fromTable.save({ session }),
        toTable.save({ session }),
      ])
      await session.commitTransaction()
    } catch (err) {
      await session.abortTransaction()
      throw err
    } finally {
      session.endSession()
    }

    const [enrichedFrom, enrichedTo] = await Promise.all([
      enrichTable(fromTable.toObject()),
      enrichTable(toTable.toObject()),
    ])
    req.io?.emit('table:updated', enrichedFrom)
    req.io?.emit('table:updated', enrichedTo)

    logger.info(`✅ Masa transferi: ${fromTable.name} → ${toTable.name}`)
    return ok(res, { fromTable: enrichedFrom, toTable: enrichedTo }, 'Masa transferi yapıldı')
  } catch (err) { next(err) }
})

module.exports = router
