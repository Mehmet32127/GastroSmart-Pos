const router = require('express').Router()
const path   = require('path')
const fs     = require('fs')
const multer = require('multer')
const Settings = require('../models/Settings')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const env  = require('../config/env')
const logger = require('../utils/logger')

// ── File upload setup ─────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve(env.UPLOAD_DIR)
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `logo-${Date.now()}${ext}`)
  },
})

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
const ALLOWED_EXTS  = ['.jpg', '.jpeg', '.png', '.webp', '.svg']

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXTS.includes(ext) || !ALLOWED_MIMES.includes(file.mimetype)) {
      return cb(new Error('Sadece resim dosyaları yüklenebilir (jpg, png, webp, svg)'))
    }
    cb(null, true)
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load all settings into a plain key→value map in a single query. */
async function loadAll() {
  const docs = await Settings.find({}).lean()
  return Object.fromEntries(docs.map(d => [d.key, d.value]))
}

/** Upsert a single setting. */
async function upsert(key, value) {
  await Settings.findOneAndUpdate(
    { key },
    { $set: { key, value } },
    { upsert: true, new: true },
  )
}

// ── GET /api/settings ─────────────────────────────────────────────────────────
router.get('/', authenticate, async (_req, res, next) => {
  try {
    const s = await loadAll()
    return ok(res, {
      restaurantName: s.restaurant_name ?? env.RESTAURANT_NAME,
      logoUrl:        s.logo_url        ?? null,
      address:        s.address         ?? null,
      phone:          s.phone           ?? null,
      taxNo:          s.tax_no          ?? null,
      receiptFooter:  s.receipt_footer  ?? 'Teşekkürler!',
      currency:       s.currency        ?? 'TRY',
      timezone:       s.timezone        ?? 'Europe/Istanbul',
    })
  } catch (err) { next(err) }
})

// ── PUT /api/settings ─────────────────────────────────────────────────────────
router.put('/', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const fieldMap = {
      restaurantName: 'restaurant_name',
      address:        'address',
      phone:          'phone',
      taxNo:          'tax_no',
      receiptFooter:  'receipt_footer',
      currency:       'currency',
      timezone:       'timezone',
    }

    const writes = []
    for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
      if (req.body[bodyKey] !== undefined) {
        writes.push(upsert(dbKey, String(req.body[bodyKey])))
      }
    }
    await Promise.all(writes)

    logger.info('✅ Ayarlar güncellendi')
    return ok(res, null, 'Ayarlar güncellendi')
  } catch (err) { next(err) }
})

// ── POST /api/settings/logo ───────────────────────────────────────────────────
router.post('/logo', authenticate, authorize('admin', 'manager'), upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 'Dosya yüklenemedi', 400)
    const url = `/uploads/${req.file.filename}`
    await upsert('logo_url', url)
    logger.info(`✅ Logo yüklendi: ${url}`)
    return ok(res, { url })
  } catch (err) { next(err) }
})

// ── GET /api/settings/theme ───────────────────────────────────────────────────
router.get('/theme', authenticate, async (_req, res, next) => {
  try {
    const s = await loadAll()
    const raw = s.theme

    const defaultTheme = {
      preset: 'dark',
      colors: {
        bg:         '#0f1117',
        surface:    '#161923',
        surface2:   '#1e2235',
        border:     '#2d3348',
        text:       '#f0f2f8',
        textMuted:  '#6b7280',
        accent:     '#f59e0b',
        accentText: '#0f1117',
      },
      borderRadius: '12px',
      fontScale:    '1',
    }

    if (!raw) return ok(res, defaultTheme)

    try {
      const theme = typeof raw === 'object' ? raw : JSON.parse(raw)
      return ok(res, Object.keys(theme).length > 0 ? theme : defaultTheme)
    } catch {
      return ok(res, defaultTheme)
    }
  } catch (err) { next(err) }
})

// ── PUT /api/settings/theme ───────────────────────────────────────────────────
router.put('/theme', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    await upsert('theme', req.body)
    req.io?.emit('theme:updated', req.body)
    logger.info('✅ Tema güncellendi')
    return ok(res, req.body, 'Tema güncellendi')
  } catch (err) { next(err) }
})

module.exports = router
