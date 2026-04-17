const router = require('express').Router()
const { z } = require('zod')
const mongoose = require('mongoose')
const Order = require('../models/Order')
const Table = require('../models/Table')
const MenuItem = require('../models/MenuItem')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail, paginate } = require('../utils/response')

// ── Formatter ─────────────────────────────────────────────────────────────────

function fmtOrder(order) {
  return {
    id:            order._id.toString(),
    tableId:       order.table_id?._id?.toString() ?? order.table_id?.toString() ?? null,
    tableName:     order.table_id?.name ?? '',
    waiterId:      order.waiter_id?._id?.toString() ?? order.waiter_id?.toString() ?? null,
    waiterName:    order.waiter_id?.full_name ?? '',
    status:        order.status,
    items:         (order.items ?? []).map(i => ({
      id:            i._id.toString(),
      orderId:       order._id.toString(),
      menuItemId:    i.menu_item_id?.toString() ?? null,
      menuItemName:  i.menu_item_name,
      quantity:      i.quantity,
      unitPrice:     i.unit_price,
      totalPrice:    i.total_price,
      tax:           i.tax,
      note:          i.note ?? null,
      status:        i.status,
      waiterId:      i.waiter_id?.toString() ?? null,
      waiterName:    i.waiter_name ?? null,
      createdAt:     i.createdAt,
      updatedAt:     i.updatedAt,
    })),
    subtotal:      order.subtotal,
    taxTotal:      order.tax_total,
    discount:      order.discount,
    discountType:  order.discount_type,
    total:         order.total,
    paidAmount:    order.paid_amount,
    cashAmount:    order.cash_amount ?? null,
    cardAmount:    order.card_amount ?? null,
    change:        order.change_amount,
    paymentMethod: order.payment_method ?? null,
    note:          order.note ?? null,
    guestCount:    order.guest_count,
    openedAt:      order.createdAt,
    closedAt:      order.closed_at ?? null,
    createdAt:     order.createdAt,
  }
}

const populateOpts = [
  { path: 'table_id',  select: 'name number' },
  { path: 'waiter_id', select: 'full_name' },
]

// ── GET /api/orders ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { tableId, status, page = 1 } = req.query
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200)
    const filter = {}

    if (tableId && mongoose.isValidObjectId(tableId)) filter.table_id = tableId
    if (status)  filter.status = status
    if (req.user.role === 'waiter') filter.waiter_id = req.user.id

    const total  = await Order.countDocuments(filter)
    const orders = await Order.find(filter)
      .populate(populateOpts)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * limit)
      .limit(limit)
      .lean()

    return paginate(res, orders.map(fmtOrder), total, page, limit)
  } catch (err) { next(err) }
})

// ── GET /api/orders/table/:tableId ────────────────────────────────────────────
router.get('/table/:tableId', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.tableId)) return ok(res, null)

    const order = await Order.findOne({ table_id: req.params.tableId, status: 'open' })
      .populate(populateOpts)
      .lean()
    return ok(res, order ? fmtOrder(order) : null)
  } catch (err) { next(err) }
})

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'Geçersiz sipariş ID', 400)
    const order = await Order.findById(req.params.id).populate(populateOpts).lean()
    if (!order) return fail(res, 'Sipariş bulunamadı', 404)
    return ok(res, fmtOrder(order))
  } catch (err) { next(err) }
})

// ── POST /api/orders — Sipariş aç ────────────────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      tableId:    z.string().min(1),
      guestCount: z.coerce.number().int().positive().default(1),
      note:       z.string().optional(),
    })
    const data = schema.parse(req.body)

    if (!mongoose.isValidObjectId(data.tableId)) return fail(res, 'Geçersiz masa ID', 400)

    const table = await Table.findById(data.tableId)
    if (!table) return fail(res, 'Masa bulunamadı', 404)

    const existing = await Order.findOne({ table_id: data.tableId, status: 'open' })
    if (existing) return fail(res, 'Bu masada zaten açık sipariş var', 409)

    const order = await Order.create({
      table_id:    data.tableId,
      waiter_id:   req.user.id,
      guest_count: data.guestCount,
      note:        data.note,
    })

    table.status = 'occupied'
    await table.save()

    const populated = await Order.findById(order._id).populate(populateOpts).lean()
    const built = fmtOrder(populated)

    req.io?.emit('order:created', built)
    req.io?.emit('table:updated', { id: data.tableId, status: 'occupied', currentOrderId: built.id })

    return ok(res, built, 'Sipariş açıldı', 201)
  } catch (err) { next(err) }
})

// ── POST /api/orders/:id/items — Ürün ekle ───────────────────────────────────
router.post('/:id/items', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      menuItemId: z.string().min(1),
      quantity:   z.coerce.number().positive().default(1),
      note:       z.string().optional(),
    })
    const data = schema.parse(req.body)

    if (!mongoose.isValidObjectId(data.menuItemId)) return fail(res, 'Geçersiz ürün ID', 400)

    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    const menuItem = await MenuItem.findOne({ _id: data.menuItemId, is_available: true })
    if (!menuItem) return fail(res, 'Ürün bulunamadı veya satışa kapalı', 404)

    const hasStock = menuItem.stock_quantity !== null && menuItem.stock_quantity !== undefined

    if (hasStock) {
      // Atomik stok azaltma — race condition engelle
      const updated = await MenuItem.findOneAndUpdate(
        { _id: menuItem._id, stock_quantity: { $gte: data.quantity } },
        { $inc: { stock_quantity: -data.quantity } },
        { new: false },
      )
      if (!updated) {
        return fail(res, `Yetersiz stok. Mevcut: ${menuItem.stock_quantity} ${menuItem.unit ?? 'adet'}`, 409)
      }
    }

    // Aynı ürün (netsiz, iptal edilmemiş) varsa miktar artır — yeni satır ekleme
    const existing = order.items.find(
      i => i.menu_item_id.toString() === data.menuItemId &&
           !i.note &&
           !data.note &&
           i.status !== 'cancelled'
    )

    if (existing) {
      existing.quantity   += data.quantity
      existing.total_price = parseFloat((existing.quantity * existing.unit_price).toFixed(2))
    } else {
      const totalPrice = parseFloat((menuItem.price * data.quantity).toFixed(2))
      order.items.push({
        menu_item_id:   menuItem._id,
        menu_item_name: menuItem.name,
        quantity:       data.quantity,
        unit_price:     menuItem.price,
        total_price:    totalPrice,
        tax:            menuItem.tax ?? 8,
        note:           data.note,
        waiter_id:      req.user.id,
        waiter_name:    req.user.fullName,
      })
    }

    order.recalculate()
    await order.save()

    const populated = await Order.findById(order._id).populate(populateOpts).lean()
    const built = fmtOrder(populated)
    // Güncellenen veya yeni eklenen kalemi döndür
    const targetId = existing ? existing._id.toString() : null
    const addedItem = targetId
      ? built.items.find(i => i.id === targetId)
      : built.items[built.items.length - 1]

    req.io?.emit('order:item:added', { tableId: order.table_id.toString(), order: built })
    req.io?.emit('table:updated', {
      id:               order.table_id.toString(),
      status:           'occupied',
      hasNewItem:       true,
      activeOrderTotal: order.total,
    })

    return ok(res, addedItem, 'Ürün eklendi', 201)
  } catch (err) { next(err) }
})

// ── PATCH /api/orders/:id/items/:itemId — Kalem güncelle ─────────────────────
router.patch('/:id/items/:itemId', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      quantity: z.coerce.number().positive().optional(),
      note:     z.string().optional(),
      status:   z.enum(['pending', 'preparing', 'served', 'cancelled']).optional(),
    })
    const data = schema.parse(req.body)

    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    const item = order.items.id(req.params.itemId)
    if (!item) return fail(res, 'Kalem bulunamadı', 404)

    // Stok iadesi: atomik $inc — race condition'ı önler
    if (data.status === 'cancelled') {
      await MenuItem.updateOne(
        { _id: item.menu_item_id, stock_quantity: { $ne: null } },
        { $inc: { stock_quantity: item.quantity } }
      )
    } else if (data.quantity !== undefined && data.quantity !== item.quantity) {
      await MenuItem.updateOne(
        { _id: item.menu_item_id, stock_quantity: { $ne: null } },
        { $inc: { stock_quantity: item.quantity - data.quantity } }
      )
    }

    if (data.quantity !== undefined) {
      item.quantity    = data.quantity
      item.total_price = parseFloat((item.unit_price * data.quantity).toFixed(2))
    }
    if (data.note   !== undefined) item.note   = data.note
    if (data.status !== undefined) item.status = data.status

    order.recalculate()
    await order.save()

    return ok(res, {
      id:       item._id.toString(),
      quantity: item.quantity,
      note:     item.note,
      status:   item.status,
    })
  } catch (err) { next(err) }
})

// ── DELETE /api/orders/:id/items/:itemId — Kalem sil ─────────────────────────
router.delete('/:id/items/:itemId', authenticate, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    const item = order.items.id(req.params.itemId)
    if (!item) return fail(res, 'Kalem bulunamadı', 404)

    if (item.status !== 'cancelled') {
      await MenuItem.updateOne(
        { _id: item.menu_item_id, stock_quantity: { $ne: null } },
        { $inc: { stock_quantity: item.quantity } }
      )
    }

    item.deleteOne()
    order.recalculate()

    // Aktif kalem kalmadıysa siparişi iptal et ve masayı boşalt
    const remaining = order.items.filter(i => i.status !== 'cancelled')
    if (remaining.length === 0) {
      order.status    = 'cancelled'
      order.closed_at = new Date()
      await order.save()

      await Table.findByIdAndUpdate(order.table_id, { status: 'available' })

      req.io?.emit('order:updated', { id: order._id.toString(), status: 'cancelled' })
      req.io?.emit('table:updated', {
        id:               order.table_id.toString(),
        status:           'available',
        currentOrderId:   null,
        activeOrderTotal: null,
      })

      return ok(res, null, 'Son ürün silindi, sipariş iptal edildi')
    }

    await order.save()

    req.io?.emit('table:updated', {
      id:               order.table_id.toString(),
      activeOrderTotal: order.total,
    })

    return ok(res, null, 'Kalem silindi')
  } catch (err) { next(err) }
})

// ── POST /api/orders/:id/cancel — Siparişi iptal et (masa boşalt) ────────────
router.post('/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    // Stokları iade et
    for (const item of order.items.filter(i => i.status !== 'cancelled')) {
      await MenuItem.updateOne(
        { _id: item.menu_item_id, stock_quantity: { $ne: null } },
        { $inc: { stock_quantity: item.quantity } }
      )
    }

    order.status    = 'cancelled'
    order.closed_at = new Date()
    await order.save()

    await Table.findByIdAndUpdate(order.table_id, { status: 'available' })

    req.io?.emit('order:updated', { id: order._id.toString(), status: 'cancelled' })
    req.io?.emit('table:updated', {
      id:               order.table_id.toString(),
      status:           'available',
      currentOrderId:   null,
      activeOrderTotal: null,
    })

    return ok(res, null, 'Sipariş iptal edildi, masa boşaltıldı')
  } catch (err) { next(err) }
})

// ── POST /api/orders/:id/close — Hesap kapat ─────────────────────────────────
router.post('/:id/close', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      paymentMethod: z.enum(['cash', 'card', 'mixed', 'complimentary']),
      paidAmount:    z.coerce.number().min(0),
      cashAmount:    z.coerce.number().min(0).optional(),
      cardAmount:    z.coerce.number().min(0).optional(),
      discount:      z.coerce.number().min(0).default(0),
      discountType:  z.enum(['percent', 'amount']).default('percent'),
      note:          z.string().optional(),
    })
    const data = schema.parse(req.body)

    if (data.discountType === 'percent' && data.discount > 100) {
      return fail(res, 'Yüzde indirim 100\'den büyük olamaz', 400)
    }

    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    if (data.discountType === 'amount' && data.discount > order.subtotal) {
      return fail(res, 'İndirim tutarı sipariş tutarından büyük olamaz', 400)
    }

    order.discount      = data.discount
    order.discount_type = data.discountType
    order.recalculate()

    order.status         = 'closed'
    order.payment_method = data.paymentMethod
    order.paid_amount    = data.paidAmount
    order.cash_amount    = data.cashAmount ?? null
    order.card_amount    = data.cardAmount ?? null
    order.change_amount  = data.paymentMethod === 'cash'
      ? Math.max(0, data.paidAmount - order.total)
      : 0
    if (data.note) order.note = data.note
    order.closed_at = new Date()

    await order.save()

    await Table.findByIdAndUpdate(order.table_id, { status: 'available' })

    const populated = await Order.findById(order._id).populate(populateOpts).lean()
    const built = fmtOrder(populated)

    req.io?.emit('order:updated', built)
    req.io?.emit('table:updated', {
      id:               order.table_id.toString(),
      status:           'available',
      currentOrderId:   null,
      activeOrderTotal: null,
    })

    return ok(res, built, 'Ödeme alındı')
  } catch (err) { next(err) }
})

// ── POST /api/orders/:id/split — Hesap bölme ─────────────────────────────────
// Bir siparişi birden fazla kişi arasında bölerek ödemek için.
// Her split kaydı kendi ödeme yöntemini içerir.
router.post('/:id/split', authenticate, async (req, res, next) => {
  try {
    const splitSchema = z.object({
      amount:        z.coerce.number().positive(),
      paymentMethod: z.enum(['cash', 'card', 'complimentary']),
    })
    const schema = z.object({
      splits:       z.array(splitSchema).min(2, 'En az 2 bölünme gerekli'),
      discount:     z.coerce.number().min(0).default(0),
      discountType: z.enum(['percent', 'amount']).default('percent'),
      note:         z.string().optional(),
    })
    const data = schema.parse(req.body)

    if (data.discountType === 'percent' && data.discount > 100) {
      return fail(res, 'Yüzde indirim 100\'den büyük olamaz', 400)
    }

    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    if (data.discountType === 'amount' && data.discount > order.subtotal) {
      return fail(res, 'İndirim tutarı sipariş tutarından büyük olamaz', 400)
    }

    order.discount      = data.discount
    order.discount_type = data.discountType
    order.recalculate()

    const splitTotal = parseFloat(data.splits.reduce((s, p) => s + p.amount, 0).toFixed(2))
    if (Math.abs(splitTotal - order.total) > 0.01) {
      return fail(res, `Bölüm toplamı (${splitTotal}) sipariş toplamıyla (${order.total}) eşleşmiyor`, 400)
    }

    // Çoklu ödeme: nakit ve kart toplamlarını hesapla
    const cashTotal = data.splits
      .filter(p => p.paymentMethod === 'cash')
      .reduce((s, p) => s + p.amount, 0)
    const cardTotal = data.splits
      .filter(p => p.paymentMethod === 'card')
      .reduce((s, p) => s + p.amount, 0)

    const paymentMethod = cashTotal > 0 && cardTotal > 0
      ? 'mixed'
      : cashTotal > 0 ? 'cash' : 'card'

    order.status         = 'closed'
    order.payment_method = paymentMethod
    order.paid_amount    = splitTotal
    order.cash_amount    = cashTotal > 0 ? cashTotal : null
    order.card_amount    = cardTotal > 0 ? cardTotal : null
    order.change_amount  = 0
    if (data.note) order.note = data.note
    order.closed_at = new Date()

    await order.save()
    await Table.findByIdAndUpdate(order.table_id, { status: 'available' })

    const populated = await Order.findById(order._id).populate(populateOpts).lean()
    const built = fmtOrder(populated)

    req.io?.emit('order:updated', built)
    req.io?.emit('table:updated', {
      id:               order.table_id.toString(),
      status:           'available',
      currentOrderId:   null,
      activeOrderTotal: null,
    })

    return ok(res, built, 'Hesap bölündü ve ödeme alındı')
  } catch (err) { next(err) }
})

// ── POST /api/orders/:id/void — İptal et ─────────────────────────────────────
router.post('/:id/void', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, status: 'open' })
    if (!order) return fail(res, 'Açık sipariş bulunamadı', 404)

    order.status    = 'voided'
    order.closed_at = new Date()
    await order.save()

    await Table.findByIdAndUpdate(order.table_id, { status: 'available' })

    req.io?.emit('table:updated', {
      id:               order.table_id.toString(),
      status:           'available',
      currentOrderId:   null,
      activeOrderTotal: null,
    })
    return ok(res, null, 'Sipariş iptal edildi')
  } catch (err) { next(err) }
})

module.exports = router
