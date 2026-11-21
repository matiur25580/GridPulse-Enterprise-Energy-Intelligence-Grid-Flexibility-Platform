import test from 'node:test'
import assert from 'node:assert/strict'
import { notificationSubscriptionSchema } from '../src/schemas/alert-notifications.schema.js'

test('notification recipients must be valid unique email addresses', () => {
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: true, emails: ['ops@example.com'] }).success, true)
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: true, emails: ['not-an-email'] }).success, false)
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: true, emails: ['ops@example.com', 'ops@example.com'] }).success, false)
})

test('enabled email delivery requires at least one recipient', () => {
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: true, emails: [] }).success, false)
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: false, emails: [] }).success, true)
})

test('recipient count is bounded and unknown fields are rejected', () => {
  const emails = Array.from({ length: 26 }, (_, index) => `ops${index}@example.com`)
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: false, emails }).success, false)
  assert.equal(notificationSubscriptionSchema.safeParse({ enabled: false, emails: [], webhookUrl: 'https://example.com' }).success, false)
})
