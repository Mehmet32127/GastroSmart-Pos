const router = require('express').Router()
const { z } = require('zod')
const mongoose = require('mongoose')
const Category = require('../models/Category')
const MenuItem = require('../models/MenuItem')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const logger = require('../utils/logger')

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCategory(c) {
  return {
    id:        c._id.toString(),
    name:      c.name,
    icon:      c.icon,
    color:     c.color,
    sortOrder: c.sort_order,
    active:    c.is_active,
  }
}

function fmtItem(i) {
  return {
    id:           i._id.toString(),
    categoryId:   i.category_id?._id?.toString() ?? i.category_id?.toString() ?? null,
    categoryName: i.categoryName ?? '',
    name:         i.name,
    description:  i.description ?? '',
    price:        i.price,
    cost:         i.cost ?? 0,
    stock:        i.stock_quantity ?? null,
    minStock:     i.min_stock ?? null,
    unit:         i.unit ?? 'adet',
    tax:          i.tax ?? 8,
    active:       i.is_available,
    imageUrl:     i.image_url ?? '',
    tags:         i.tags ?? [],
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

router.get('/categories', authenticate, async (_req, res, next) => {
  try {
    const cats = await Category.find({ is_active: true }).sort({ sort_order: 1 }).lean()
    return ok(res, cats.map(fmtCategory))
  } catch (err) { next(err) }
})

router.post('/categories', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      name:      z.string().min(1),
      icon:      z.string().default('🍽️'),
      color:     z.string().default('#f59e0b'),
      sortOrder: z.coerce.number().default(0),
    })
    const data = schema.parse(req.body)

    const existing = await Category.findOne({ name: data.name, is_active: true }).lean()
    if (existing) return fail(res, `"${data.name}" adında bir kategori zaten mevcut`, 409)

    const cat = await Category.create({
      name:       data.name,
      icon:       data.icon,
      color:      data.color,
      sort_order: data.sortOrder,
      is_active:  true,
    })
    logger.info(`✅ Kategori oluşturuldu: ${cat.name}`)
    return ok(res, fmtCategory(cat), 'Kategori oluşturuldu', 201)
  } catch (err) { next(err) }
})

router.put('/categories/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      name:      z.string().min(1).optional(),
      icon:      z.string().optional(),
      color:     z.string().optional(),
      sortOrder: z.coerce.number().optional(),
      active:    z.boolean().optional(),
    })
    const data = schema.parse(req.body)

    const update = {}
    if (data.name      !== undefined) update.name      = data.name
    if (data.icon      !== undefined) update.icon      = data.icon
    if (data.color     !== undefined) update.color     = data.color
    if (data.sortOrder !== undefined) update.sort_order = data.sortOrder
    if (data.active    !== undefined) update.is_active  = data.active

    const cat = await Category.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).lean()
    if (!cat) return fail(res, 'Kategori bulunamadı', 404)

    logger.info(`✅ Kategori güncellendi: ${cat.name}`)
    return ok(res, fmtCategory(cat))
  } catch (err) { next(err) }
})

router.delete('/categories/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const cat = await Category.findByIdAndDelete(req.params.id)
    if (!cat) return fail(res, 'Kategori bulunamadı', 404)
    logger.info(`✅ Kategori silindi: ${cat.name}`)
    return ok(res, null, 'Kategori silindi')
  } catch (err) { next(err) }
})

// ── Menu Items ────────────────────────────────────────────────────────────────

router.get('/items', authenticate, async (req, res, next) => {
  try {
    const { categoryId, active, search } = req.query
    const filter = {}

    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) return fail(res, 'Geçersiz kategori ID', 400)
      filter.category_id = new mongoose.Types.ObjectId(categoryId)
    }
    if (active !== undefined) filter.is_available = active === 'true'
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.name = { $regex: escaped, $options: 'i' }
    }

    const items = await MenuItem.find(filter)
      .populate('category_id', 'name')
      .lean()

    const result = items.map(i => fmtItem({ ...i, categoryName: i.category_id?.name }))
    return ok(res, result)
  } catch (err) { next(err) }
})

router.get('/items/:id', authenticate, async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id).populate('category_id', 'name').lean()
    if (!item) return fail(res, 'Ürün bulunamadı', 404)
    return ok(res, fmtItem({ ...item, categoryName: item.category_id?.name }))
  } catch (err) { next(err) }
})

router.post('/items', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      categoryId:  z.string().min(1),
      name:        z.string().min(1),
      description: z.string().optional(),
      price:       z.coerce.number().positive(),
      cost:        z.coerce.number().min(0).optional(),
      stock:       z.coerce.number().min(0).optional(),
      minStock:    z.coerce.number().min(0).optional(),
      unit:        z.string().default('adet'),
      tax:         z.coerce.number().min(0).default(8),
      imageUrl:    z.string().optional(),
      tags:        z.array(z.string()).optional(),
    })
    const data = schema.parse(req.body)

    const catExists = await Category.findById(data.categoryId)
    if (!catExists) return fail(res, 'Kategori bulunamadı', 404)

    const item = await MenuItem.create({
      category_id:    data.categoryId,
      name:           data.name,
      description:    data.description,
      price:          data.price,
      cost:           data.cost ?? 0,
      stock_quantity: data.stock ?? null,
      min_stock:      data.minStock ?? null,
      unit:           data.unit,
      tax:            data.tax,
      is_available:   true,
      image_url:      data.imageUrl,
      tags:           data.tags ?? [],
    })

    const populated = await MenuItem.findById(item._id).populate('category_id', 'name').lean()
    logger.info(`✅ Ürün oluşturuldu: ${item.name}`)
    return ok(res, fmtItem({ ...populated, categoryName: populated.category_id?.name }), 'Ürün oluşturuldu', 201)
  } catch (err) { next(err) }
})

router.put('/items/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      categoryId:  z.string().optional(),
      name:        z.string().min(1).optional(),
      description: z.string().optional(),
      price:       z.coerce.number().positive().optional(),
      cost:        z.coerce.number().min(0).optional(),
      stock:       z.coerce.number().min(0).nullable().optional(),
      minStock:    z.coerce.number().min(0).nullable().optional(),
      unit:        z.string().optional(),
      tax:         z.coerce.number().min(0).optional(),
      active:      z.boolean().optional(),
      imageUrl:    z.string().optional(),
      tags:        z.array(z.string()).optional(),
    })
    const data = schema.parse(req.body)

    const update = {}
    if (data.categoryId  !== undefined) update.category_id    = data.categoryId
    if (data.name        !== undefined) update.name           = data.name
    if (data.description !== undefined) update.description    = data.description
    if (data.price       !== undefined) update.price          = data.price
    if (data.cost        !== undefined) update.cost           = data.cost
    if (data.stock       !== undefined) update.stock_quantity = data.stock
    if (data.minStock    !== undefined) update.min_stock      = data.minStock
    if (data.unit        !== undefined) update.unit           = data.unit
    if (data.tax         !== undefined) update.tax            = data.tax
    if (data.active      !== undefined) update.is_available   = data.active
    if (data.imageUrl    !== undefined) update.image_url      = data.imageUrl
    if (data.tags        !== undefined) update.tags           = data.tags

    const item = await MenuItem.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate('category_id', 'name').lean()
    if (!item) return fail(res, 'Ürün bulunamadı', 404)

    logger.info(`✅ Ürün güncellendi: ${item.name}`)
    return ok(res, fmtItem({ ...item, categoryName: item.category_id?.name }))
  } catch (err) { next(err) }
})

router.delete('/items/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id)
    if (!item) return fail(res, 'Ürün bulunamadı', 404)
    logger.info(`✅ Ürün silindi: ${item.name}`)
    return ok(res, null, 'Ürün silindi')
  } catch (err) { next(err) }
})

// ── PATCH /api/menu/items/:id/stock ──────────────────────────────────────────
router.patch('/items/:id/stock', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const schema = z.object({
      quantity:  z.coerce.number(),
      operation: z.enum(['set', 'add', 'subtract']).default('set'),
    })
    const { quantity, operation } = schema.parse(req.body)

    const item = await MenuItem.findById(req.params.id)
    if (!item) return fail(res, 'Ürün bulunamadı', 404)

    if (operation === 'set') {
      item.stock_quantity = quantity
    } else if (operation === 'add') {
      item.stock_quantity = (item.stock_quantity ?? 0) + quantity
    } else {
      item.stock_quantity = Math.max(0, (item.stock_quantity ?? 0) - quantity)
    }

    await item.save()
    const populated = await MenuItem.findById(item._id).populate('category_id', 'name').lean()
    logger.info(`✅ Stok güncellendi: ${item.name} → ${item.stock_quantity}`)
    return ok(res, fmtItem({ ...populated, categoryName: populated.category_id?.name }))
  } catch (err) { next(err) }
})

module.exports = router
