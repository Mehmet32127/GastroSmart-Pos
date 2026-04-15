const mongoose = require('mongoose')

const refreshTokenSchema = new mongoose.Schema({
  hash:      { type: String, required: true, unique: true, index: true },
  uid:       { type: String, required: true, index: true },
  role:      { type: String, required: true },
  expiresAt: { type: Date,   required: true },
}, { timestamps: false })

// MongoDB TTL index — expired token'ları otomatik sil
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('RefreshToken', refreshTokenSchema)
