const router = require('express').Router()
const { z } = require('zod')
const User = require('../models/User')
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} = require('../utils/jwt')
const { authenticate } = require('../middleware/auth')
const { ok, fail } = require('../utils/response')
const logger = require('../utils/logger')

const loginSchema = z.object({
  username: z.string().min(1, 'Kullanıcı adı gerekli'),
  password: z.string().min(1, 'Şifre gerekli'),
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body)

    const user = await User.findOne({ username: username.toLowerCase().trim() })
    if (!user || !user.is_active) {
      logger.warn(`❌ Başarısız giriş: ${username}`)
      return fail(res, 'Kullanıcı adı veya şifre hatalı', 401)
    }

    const valid = await user.comparePassword(password)
    if (!valid) {
      logger.warn(`❌ Yanlış şifre: ${username}`)
      return fail(res, 'Kullanıcı adı veya şifre hatalı', 401)
    }

    user.last_login = new Date()
    await user.save()

    const uid = user._id.toString()
    const accessToken  = generateAccessToken(uid, user.role)
    const refreshToken = await generateRefreshToken(uid, user.role)

    logger.info(`✅ Giriş: ${user.username} (${user.role})`)

    return ok(res, {
      user: {
        id:        user._id.toString(),
        username:  user.username,
        fullName:  user.full_name,
        role:      user.role,
        email:     user.email ?? null,
        phone:     user.phone ?? null,
        active:    user.is_active,
        createdAt: user.createdAt,
      },
      tokens: { accessToken, refreshToken },
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) await revokeRefreshToken(refreshToken)
    return ok(res, null, 'Çıkış yapıldı')
  } catch (err) { next(err) }
})

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) return fail(res, 'Refresh token gerekli', 401)

    const record = await verifyRefreshToken(refreshToken)
    if (!record) return fail(res, 'Geçersiz veya süresi dolmuş token', 401)

    await revokeRefreshToken(refreshToken)
    const newAccess  = generateAccessToken(record.uid, record.role)
    const newRefresh = await generateRefreshToken(record.uid, record.role)

    return ok(res, { accessToken: newAccess, refreshToken: newRefresh })
  } catch (err) { next(err) }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash').lean()
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)

    return ok(res, {
      id:        user._id.toString(),
      username:  user.username,
      fullName:  user.full_name,
      role:      user.role,
      email:     user.email ?? null,
      phone:     user.phone ?? null,
      active:    user.is_active,
      createdAt: user.createdAt,
      lastLogin: user.last_login ?? null,
    })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/auth/change-password ────────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8, 'Şifre en az 8 karakter olmalı')
        .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermeli')
        .regex(/[0-9]/, 'Şifre en az bir rakam içermeli'),
    })
    const { currentPassword, newPassword } = schema.parse(req.body)

    const user = await User.findById(req.user.id)
    if (!user) return fail(res, 'Kullanıcı bulunamadı', 404)

    const valid = await user.comparePassword(currentPassword)
    if (!valid) return fail(res, 'Mevcut şifre hatalı', 400)

    user.password_hash = newPassword   // pre-save hook hashes it
    await user.save()
    await revokeAllUserTokens(req.user.id)

    logger.info(`✅ Şifre değiştirildi: ${user.username}`)
    return ok(res, null, 'Şifre güncellendi')
  } catch (err) {
    next(err)
  }
})

module.exports = router
