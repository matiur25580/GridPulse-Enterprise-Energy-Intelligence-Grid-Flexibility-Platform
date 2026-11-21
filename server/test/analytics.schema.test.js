import test from 'node:test'
import assert from 'node:assert/strict'
import { analyticsQuerySchema } from '../src/schemas/analytics.schema.js'

test('analytics query accepts a valid date range', () => {
  const result = analyticsQuerySchema.safeParse({
    from: '2026-11-01T00:00:00.000Z',
    to: '2026-11-21T00:00:00.000Z',
  })
  assert.equal(result.success, true)
})

test('analytics query rejects an inverted date range', () => {
  const result = analyticsQuerySchema.safeParse({
    from: '2026-11-21T00:00:00.000Z',
    to: '2026-11-01T00:00:00.000Z',
  })
  assert.equal(result.success, false)
})
