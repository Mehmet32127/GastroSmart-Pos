const crypto = require('crypto')
const env = require('../config/env')

function signPayload(payload) {
  const data = JSON.stringify(payload)
  return crypto.createHmac('sha256', env.HMAC_SECRET).update(data).digest('hex')
}

function verifySignature(payload, signature) {
  const expected = signPayload(payload)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}

module.exports = { signPayload, verifySignature }
