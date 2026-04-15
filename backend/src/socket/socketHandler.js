const jwt = require('jsonwebtoken')
const env = require('../config/env')
const User = require('../models/User')

function setupSocket(io) {
  // ── Auth middleware ────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Token gerekli'))

    try {
      const payload = jwt.verify(token, env.JWT_SECRET)
      const user = await User.findById(payload.userId).select('username full_name role is_active').lean()
      if (!user || !user.is_active) return next(new Error('Yetkisiz'))

      socket.user = {
        id: user._id.toString(),
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      }
      next()
    } catch {
      next(new Error('Geçersiz token'))
    }
  })

  // ── Connection ─────────────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const { user } = socket

    // Each user gets a private room; admins/managers join the broadcast room
    socket.join(`user:${user.id}`)
    if (['admin', 'manager'].includes(user.role)) {
      socket.join('managers')
    }

    // Table-level rooms — clients subscribe when they open a table
    socket.on('table:join', ({ tableId }) => socket.join(`table:${tableId}`))
    socket.on('table:leave', ({ tableId }) => socket.leave(`table:${tableId}`))

    // Keep-alive ping/pong
    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit('ping')
    }, 30_000)

    socket.on('ping', () => socket.emit('pong'))

    socket.on('disconnect', () => clearInterval(heartbeat))
  })

  return io
}

module.exports = { setupSocket }
