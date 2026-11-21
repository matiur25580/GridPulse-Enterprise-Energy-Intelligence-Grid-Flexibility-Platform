import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function encryptionKey(value) {
  if (!value || value.length < 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must contain at least 32 characters.')
  return createHash('sha256').update(value, 'utf8').digest()
}

export function encryptGatewaySecret(secret, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return { secretCiphertext: ciphertext.toString('base64'), secretIv: iv.toString('base64'), secretTag: cipher.getAuthTag().toString('base64') }
}

export function decryptGatewaySecret(record, key) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), Buffer.from(record.secretIv, 'base64'))
  decipher.setAuthTag(Buffer.from(record.secretTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(record.secretCiphertext, 'base64')), decipher.final()]).toString('utf8')
}

export function gatewaySignature(secret, timestamp, rawBody) {
  return 'sha256=' + createHmac('sha256', secret).update(timestamp + '.').update(rawBody).digest('hex')
}

export function safeSignatureEqual(expected, supplied) {
  if (typeof supplied !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(supplied)) return false
  const left = Buffer.from(expected, 'utf8')
  const right = Buffer.from(supplied, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}
