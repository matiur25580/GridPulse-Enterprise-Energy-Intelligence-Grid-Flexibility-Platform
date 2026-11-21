import test from 'node:test'\nimport { GatewayRequestNonce } from '../src/models/gateway-request-nonce.model.js'

test('gateway replay nonce schema enforces unique signatures per source and TTL expiry', () => {
  const indexes = GatewayRequestNonce.schema.indexes()
  assert.ok(indexes.some(([keys, options]) => keys.source === 1 && keys.signature === 1 && options.unique === true))
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0))
})
import assert from 'node:assert/strict'
import { decryptGatewaySecret, encryptGatewaySecret, gatewaySignature, safeSignatureEqual } from '../src/utils/gateway-security.js'

const key = 'test-only-encryption-key-with-more-than-32-characters'
const secret = 'a'.repeat(64)
const body = Buffer.from('{"events":[{"eventId":"1"}]}')
const timestamp = '1795291200'

test('encrypts gateway secrets at rest and decrypts only with the configured key', () => {
  const encrypted = encryptGatewaySecret(secret, key)
  assert.notEqual(encrypted.secretCiphertext, secret)
  assert.equal(decryptGatewaySecret(encrypted, key), secret)
  assert.throws(() => decryptGatewaySecret(encrypted, 'different-key-with-more-than-32-characters'))
})

test('signatures are bound to timestamp and exact raw body', () => {
  const signature = gatewaySignature(secret, timestamp, body)
  assert.equal(safeSignatureEqual(signature, signature), true)
  assert.equal(safeSignatureEqual(gatewaySignature(secret, '1795291201', body), signature), false)
  assert.equal(safeSignatureEqual(gatewaySignature(secret, timestamp, Buffer.from('{}')), signature), false)
  assert.equal(safeSignatureEqual(signature, 'sha256=bad'), false)
})
