import test from 'node:test'
import assert from 'node:assert/strict'
import { registerSchema, loginSchema } from '../src/schemas/auth.schema.js'

test('registration normalizes email and accepts a strong password', () => {
  const result = registerSchema.parse({
    name: 'GridPulse Admin',
    email: 'ADMIN@EXAMPLE.COM',
    password: 'StrongPassword2026',
    organizationName: 'Northwind Energy',
  })
  assert.equal(result.email, 'admin@example.com')
})

test('registration rejects short passwords', () => {
  const result = registerSchema.safeParse({
    name: 'GridPulse Admin',
    email: 'admin@example.com',
    password: 'short',
    organizationName: 'Northwind Energy',
  })
  assert.equal(result.success, false)
})

test('login rejects malformed email addresses', () => {
  const result = loginSchema.safeParse({ email: 'not-an-email', password: 'whatever' })
  assert.equal(result.success, false)
})
