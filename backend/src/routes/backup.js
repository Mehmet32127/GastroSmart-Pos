const router = require('express').Router()
const path   = require('path')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const { restoreBackup, listBackups, createManualBackup } = require('../utils/backup')
const logger = require('../utils/logger')

// Sadece alfanümerik, tire ve alt çizgi — path traversal engelle
function sanitizeBackupName(name) {
  if (typeof name !== 'string') return null
  const safe = path.basename(name).replace(/[^a-zA-Z0-9_\-]/g, '')
  return safe.length > 0 ? safe : null
}

// ── GET /api/backup/list ──────────────────────────────────────────────────────
router.get('/list', authenticate, authorize('admin'), async (_req, res, next) => {
  try {
    const backups = listBackups()
    return ok(res, backups)
  } catch (err) { next(err) }
})

// ── POST /api/backup/manual ───────────────────────────────────────────────────
router.post('/manual', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { description } = req.body
    const result = await createManualBackup(description)

    if (result.success) {
      logger.info(`Manuel backup oluşturuldu: ${result.filename}`)
      return ok(res, result, 'Manuel backup başarılı', 201)
    }
    return fail(res, result.error || 'Backup başarısız', 500)
  } catch (err) { next(err) }
})

// ── POST /api/backup/restore ──────────────────────────────────────────────────
router.post('/restore', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { filename } = req.body
    if (!filename) return fail(res, 'Backup adı gerekli', 400)

    const safe = sanitizeBackupName(filename)
    if (!safe) return fail(res, 'Geçersiz backup adı', 400)

    const success = await restoreBackup(safe)
    if (success) {
      logger.info(`Backup restore edildi: ${filename}`)
      return ok(res, null, 'Restore başarılı')
    }
    return fail(res, 'Restore başarısız', 500)
  } catch (err) { next(err) }
})

module.exports = router
