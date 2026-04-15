const router   = require('express').Router()
const { z }    = require('zod')
const mongoose = require('mongoose')
const OfflineQueueLog = require('../models/OfflineQueueLog')
const Table    = require('../models/Table')
const Order    = require('../models/Order')
const MenuItem = require('../models/MenuItem')
const { authenticate }   = require('../middleware/auth')
const { verifySignature } = require('../utils/hmac')
const { ok, fail }       = require('../utils/response')

// ── POST /api/sync/queue — Process an offline queue item ──────────────────────
router.post('/queue', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      id:        z.string(),
      type:      z.string(),
      payload:   z.record(z.unknown()),
      hmac:      z.string(),
      createdAt: z.string(),
    })
    const { id, type, payload, hmac } = schema.parse(req.body)

    // ── Idempotency: skip if already processed ────────────────────────────────
    const existing = await OfflineQueueLog.findOne({ queue_id: id }).lean()
    if (existing) {
      return ok(res, { id, status: 'already_processed' }, 'Zaten işlendi')
    }

    // ── Verify HMAC integrity ─────────────────────────────────────────────────
    if (!verifySignature(payload, hmac)) {
      return fail(res, 'HMAC doğrulama başarısız', 401)
    }

    // ── Record the attempt before processing (prevents duplicate races) ───────
    await OfflineQueueLog.create({
      queue_id:     id,
      type,
      payload,
      hmac,
      status:       'processing',
      processed_by: req.user.id,
    })

    let result = null
    try {
      result = await processQueueItem(type, payload, req.user, req)
      await OfflineQueueLog.updateOne({ queue_id: id }, { $set: { status: 'processed' } })
    } catch (processErr) {
      await OfflineQueueLog.updateOne({ queue_id: id }, { $set: { status: 'failed' } })
      return fail(res, `İşlem hatası: ${processErr.message}`, 422)
    }

    return ok(res, { id, type, status: 'processed', result }, 'İşlem tamamlandı')
  } catch (err) { next(err) }
})

// ── Queue item processor ──────────────────────────────────────────────────────

async function processQueueItem(type, payload, user, req) {
  switch (type) {

    case 'UPDATE_TABLE_STATUS': {
      const { tableId, status } = payload
      const valid = ['available', 'occupied', 'reserved', 'cleaning']
      if (!valid.includes(status))              throw new Error('Geçersiz masa durumu')
      if (!mongoose.isValidObjectId(tableId))   throw new Error('Geçersiz masa ID')

      await Table.findByIdAndUpdate(tableId, { status })
      req.io?.emit('table:updated', { id: tableId, status })
      return { tableId, status }
    }

    case 'CREATE_ORDER': {
      const { tableId, guestCount = 1, note } = payload
      if (!mongoose.isValidObjectId(tableId)) throw new Error('Geçersiz masa ID')

      // Idempotent: return existing open order if one exists
      const existing = await Order.findOne({ table_id: tableId, status: 'open' }).lean()
      if (existing) return { orderId: existing._id }

      const order = await Order.create({
        table_id:    tableId,
        waiter_id:   user.id,
        guest_count: guestCount,
        note,
      })
      await Table.findByIdAndUpdate(tableId, { status: 'occupied' })
      req.io?.emit('order:created',  { id: order._id, tableId })
      req.io?.emit('table:updated',  { id: tableId, status: 'occupied' })
      return { orderId: order._id }
    }

    case 'ADD_ORDER_ITEM': {
      const { orderId, menuItemId, quantity = 1, note } = payload
      if (!mongoose.isValidObjectId(orderId))    throw new Error('Geçersiz sipariş ID')
      if (!mongoose.isValidObjectId(menuItemId)) throw new Error('Geçersiz ürün ID')
      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Geçersiz miktar')

      const order = await Order.findOne({ _id: orderId, status: 'open' })
      if (!order) throw new Error('Açık sipariş bulunamadı')

      const menuItem = await MenuItem.findOne({ _id: menuItemId, is_available: true })
      if (!menuItem) throw new Error('Ürün bulunamadı veya satışa kapalı')

      const hasStock = menuItem.stock_quantity !== null && menuItem.stock_quantity !== undefined

      if (hasStock) {
        // Atomik stok azaltma — orders.js ile aynı pattern, race condition önler
        const updated = await MenuItem.findOneAndUpdate(
          { _id: menuItem._id, stock_quantity: { $gte: qty } },
          { $inc: { stock_quantity: -qty } },
          { new: false },
        )
        if (!updated) {
          throw new Error(`Yetersiz stok. Mevcut: ${menuItem.stock_quantity} ${menuItem.unit ?? 'adet'}`)
        }
      }

      const totalPrice = parseFloat((menuItem.price * qty).toFixed(2))
      order.items.push({
        menu_item_id:   menuItem._id,
        menu_item_name: menuItem.name,
        quantity:    qty,
        unit_price:  menuItem.price,
        total_price: totalPrice,
        tax:         menuItem.tax ?? 8,
        note,
        waiter_id:   user.id,
        waiter_name: user.fullName,
      })
      order.recalculate()
      await order.save()

      const addedItem = order.items[order.items.length - 1]
      return { itemId: addedItem._id }
    }

    default:
      throw new Error(`Bilinmeyen işlem tipi: ${type}`)
  }
}

module.exports = router
