const jwt = require('jsonwebtoken')
const env = require('../config/env')
const User = require('../models/User')
const logger = require('../utils/logger')

/**
 * Verifies the Bearer token and attaches req.user.
 * Uses MongoDB so the token's userId (MongoDB ObjectId) is resolved correctly.
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token gerekli' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    const user = await User.findById(payload.userId).select('-password_hash').lean()

    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, error: 'Yetkisiz erişim' })
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email ?? null,
      phone: user.phone ?? null,
    }
    next()
  } catch (err) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (err.name === 'TokenExpiredError') {
      logger.warn(`🔑 Token süresi doldu — IP: ${ip} PATH: ${req.path}`)
      return res.status(401).json({ success: false, error: 'Token süresi doldu' })
    }
    logger.warn(`🔑 Geçersiz token — IP: ${ip} PATH: ${req.path} ERR: ${err.message}`)
    return res.status(401).json({ success: false, error: 'Geçersiz token' })
  }
}

/**
 * Role-based access control — call after authenticate().
 * Usage: authorize('admin', 'manager')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Kimlik doğrulaması gerekli' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Bu işlem için yetkiniz yok. Gereken: ${roles.join(' veya ')}`,
      })
    }
    next()
  }
}

module.exports = { authenticate, authorize }
