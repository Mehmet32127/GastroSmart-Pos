const router = require('express').Router()
const { z } = require('zod')
const User = require('../models/User')
const { authenticate, authorize } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const { revokeAllUserTokens } = require('../utils/jwt')
const logger = require('../utils/logger')

function fmtUser(u) {
  return {
    id:        u._id.toString(),
    username:  u.username,
    fullName:  u.full_name,
    role:      u.role,
    email:     u.email ?? null,
    phone:     u.phone ?? null,
    active:    u.is_active,
    createdAt: u.createdAt,
  }
}

// ── GET /api/users ────────────────────────────────────────────────────────────
router.get('/', authenticate, authorize('admin', 'manager'), async (_req, res, next) => {
  try {
    const users = await User.find().select('-password_hash').sort({ createdAt: -1 }).lean()
    return ok(res, users.map(fmtUser))
  } catch (err) { next(err) }
})

// ── GET /api/users/:id ────────────────────────────────────────────────────────
router.get('/:id', authenticate, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash').lean()
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)
    return ok(res, fmtUser(user))
  } catch (err) { next(err) }
})

// ── POST /api/users ───────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(32),
      password: z.string().min(8),
      fullName: z.string().min(2),
      role:     z.enum(['admin', 'manager', 'waiter']),
      email:    z.string().email().optional(),
      phone:    z.string().optional(),
    })
    const data = schema.parse(req.body)

    const exists = await User.findOne({ username: data.username.toLowerCase() })
    if (exists) return fail(res, 'Bu kullanıcı adı zaten kullanılıyor', 409)

    const user = await User.create({
      username:      data.username.toLowerCase(),
      password_hash: data.password,   // pre-save hook hashes it
      full_name:     data.fullName,
      role:          data.role,
      email:         data.email,
      phone:         data.phone,
      is_active:     true,
    })

    logger.info(`✅ Kullanıcı oluşturuldu: ${user.username} (${user.role})`)
    return ok(res, fmtUser(user), 'Kullanıcı oluşturuldu', 201)
  } catch (err) { next(err) }
})

// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
router.patch('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(32).optional(),
      fullName: z.string().min(2).optional(),
      role:     z.enum(['admin', 'manager', 'waiter']).optional(),
      email:    z.string().email().optional(),
      phone:    z.string().optional(),
      active:   z.boolean().optional(),
    })
    const data = schema.parse(req.body)

    const user = await User.findById(req.params.id)
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)

    if (data.username !== undefined) {
      const newUsername = data.username.toLowerCase().trim()
      if (newUsername !== user.username) {
        const exists = await User.findOne({ username: newUsername, _id: { $ne: user._id } })
        if (exists) return fail(res, 'Bu kullanıcı adı zaten kullanılıyor', 409)
        user.username = newUsername
        // Kullanıcı adı değişince token'ları iptal et → tekrar giriş gerekir
        await revokeAllUserTokens(user._id.toString())
      }
    }
    if (data.fullName !== undefined) user.full_name = data.fullName
    if (data.role     !== undefined) user.role      = data.role
    if (data.email    !== undefined) user.email     = data.email
    if (data.phone    !== undefined) user.phone     = data.phone
    if (data.active   !== undefined) {
      user.is_active = data.active
      if (!data.active) await revokeAllUserTokens(user._id.toString())
    }

    await user.save()
    logger.info(`✅ Kullanıcı güncellendi: ${user.username}`)
    return ok(res, fmtUser(user))
  } catch (err) { next(err) }
})

// ── POST /api/users/:id/reset-password — Admin şifre sıfırlama ───────────────
router.post('/:id/reset-password', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const schema = z.object({
      newPassword: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
    })
    const { newPassword } = schema.parse(req.body)

    const user = await User.findById(req.params.id)
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)

    user.password_hash = newPassword  // pre-save hook hashes it
    await user.save()
    await revokeAllUserTokens(user._id.toString())

    logger.info(`✅ Şifre sıfırlandı: ${user.username}`)
    return ok(res, null, 'Şifre sıfırlandı')
  } catch (err) { next(err) }
})

// ── PATCH /api/users/:id/toggle — Aktif/pasif geçiş ─────────────────────────
router.patch('/:id/toggle', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return fail(res, 'Kendi hesabınızı devre dışı bırakamazsınız', 400)
    }

    const user = await User.findById(req.params.id)
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)

    user.is_active = !user.is_active
    await user.save()

    if (!user.is_active) await revokeAllUserTokens(user._id.toString())

    logger.info(`✅ Kullanıcı ${user.is_active ? 'aktif' : 'pasif'}: ${user.username}`)
    return ok(res, fmtUser(user))
  } catch (err) { next(err) }
})

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return fail(res, 'Kendi hesabınızı silemezsiniz', 400)
    }
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)

    await revokeAllUserTokens(req.params.id)
    logger.info(`✅ Kullanıcı silindi: ${user.username}`)
    return ok(res, null, 'Kullanıcı silindi')
  } catch (err) { next(err) }
})

module.exports = router
