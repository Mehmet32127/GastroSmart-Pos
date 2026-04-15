const router = require('express').Router()
const { z } = require('zod')
const nodemailer = require('nodemailer')
const rateLimit = require('express-rate-limit')
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

const forgotPasswordLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 saat
  max: 5,
  message: { success: false, error: 'Çok fazla istek. 1 saat sonra tekrar deneyin.' },
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Mailer ────────────────────────────────────────────────────────────────────
function getMailer() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

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

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', forgotPasswordLimit, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    // Güvenlik: kullanıcı bulunsun ya da bulunmasın aynı mesajı dön
    if (!user || !user.is_active) {
      return ok(res, null, 'E-posta adresinize bilgi gönderildi')
    }

    const mailer = getMailer()
    if (!mailer) {
      return fail(res, 'E-posta servisi yapılandırılmamış. Lütfen yöneticinize başvurun.', 503)
    }

    const newPassword = randomPassword()

    // Mail önce gönder — başarısız olursa şifre değişmemiş olur
    await mailer.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      user.email,
      subject: 'GastroSmart POS — Şifre Sıfırlama',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
          <h2 style="color:#f59e0b">GastroSmart POS</h2>
          <p>Merhaba <strong>${user.full_name}</strong>,</p>
          <p>Hesabınız için yeni bir şifre oluşturuldu:</p>
          <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0">
            <p style="margin:0 0 8px">Kullanıcı Adı: <strong>${user.username}</strong></p>
            <p style="margin:0">Yeni Şifre: <strong style="font-size:18px;letter-spacing:2px">${newPassword}</strong></p>
          </div>
          <p>Giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.</p>
          <p style="color:#9ca3af;font-size:12px">Bu e-postayı siz talep etmediyseniz lütfen yöneticinize bildirin.</p>
        </div>
      `,
    })

    // Mail başarılı → şimdi şifreyi kaydet
    user.password_hash = newPassword
    await user.save()
    await revokeAllUserTokens(user._id.toString())

    logger.info(`✅ Şifre sıfırlama maili gönderildi: ${user.username}`)
    return ok(res, null, 'E-posta adresinize yeni şifreniz gönderildi')
  } catch (err) {
    next(err)
  }
})

module.exports = router
