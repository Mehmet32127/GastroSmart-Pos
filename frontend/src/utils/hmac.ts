import { CONFIG } from '@/config'

// Browser-native HMAC-SHA256 implementation
async function createHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function bufferToHex(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function signPayload(payload: Record<string, unknown>): Promise<string> {
  const encoder = new TextEncoder()
  const key = await createHmacKey(CONFIG.HMAC_SECRET)
  const data = JSON.stringify(payload)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return bufferToHex(signature)
}

export async function verifySignature(
  payload: Record<string, unknown>,
  signature: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await createHmacKey(CONFIG.HMAC_SECRET)
    const data = JSON.stringify(payload)
    const sigBytes = new Uint8Array(signature.match(/.{2}/g)!.map(b => parseInt(b, 16)))
    return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
  } catch {
    return false
  }
}
