const jwt    = require('jsonwebtoken')
const crypto = require('crypto')
const env    = require('../config/env')
const RefreshToken = require('../models/RefreshToken')

// ─── Access Token ─────────────────────────────────────────────────────────────

function generateAccessToken(userId, role) {
  return jwt.sign(
    { userId: userId.toString(), role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN || '1h' }
  )
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

async function generateRefreshToken(userId, role) {
  const token     = crypto.randomBytes(48).toString('hex')
  const hash      = crypto.createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 gün

  await RefreshToken.create({ hash, uid: userId.toString(), role, expiresAt })
  return token
}

async function verifyRefreshToken(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const rec  = await RefreshToken.findOne({ hash, expiresAt: { $gt: new Date() } }).lean()
  if (!rec) return null
  return { uid: rec.uid, role: rec.role }
}

async function revokeRefreshToken(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  await RefreshToken.deleteOne({ hash })
}

async function revokeAllUserTokens(userId) {
  await RefreshToken.deleteMany({ uid: userId.toString() })
}

// Artık gerekli değil — MongoDB TTL index hallediyor.
// Geriye dönük uyumluluk için boş bırakıldı.
function cleanExpiredTokens() {}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanExpiredTokens,
}
