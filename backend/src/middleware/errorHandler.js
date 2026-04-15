const { ZodError } = require('zod')
const logger = require('../utils/logger')

function errorHandler(err, req, res, _next) {
  // ── Zod validation error ───────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    logger.warn(`Validasyon hatası: ${messages}`, { path: req.path })
    return res.status(400).json({ success: false, error: `Doğrulama hatası: ${messages}` })
  }

  // ── MongoDB duplicate key (unique index violation) ─────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'alan'
    logger.warn(`Çift kayıt hatası: ${field}`, { path: req.path })
    return res.status(409).json({ success: false, error: 'Bu kayıt zaten mevcut' })
  }

  // ── MongoDB CastError (invalid ObjectId) ──────────────────────────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({ success: false, error: 'Geçersiz ID formatı' })
  }

  // ── Mongoose ValidationError ──────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message).join(', ')
    return res.status(400).json({ success: false, error: messages })
  }

  // ── Multer file-size error ─────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'Dosya boyutu çok büyük' })
  }

  // ── Generic server error ───────────────────────────────────────────────────
  logger.error(`HTTP hatası: ${err.message}`, {
    message: err.message,
    code:    err.code,
    path:    req.path,
    method:  req.method,
    status:  err.status || 500,
  })

  return res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Sunucu hatası' : err.message,
  })
}

module.exports = { errorHandler }
