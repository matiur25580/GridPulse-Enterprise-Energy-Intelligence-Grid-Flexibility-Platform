import test from 'node:test'
import assert from 'node:assert/strict'
import { reportQuerySchema } from '../src/schemas/report.schema.js'

test('accepts a bounded report period and defaults emissions factor', () => {
  const result = reportQuerySchema.safeParse({ from: '2026-01-01T00:00:00Z', to: '2026-01-31T23:59:59Z' })
  assert.equal(result.success, true)
  if (result.success) assert.equal(result.data.gridEmissionFactorKgPerKwh, 0.4)
})

test('rejects reversed, oversized, and invalid emissions inputs', () => {
  assert.equal(reportQuerySchema.safeParse({ from: '2026-02-01', to: '2026-01-01' }).success, false)
  assert.equal(reportQuerySchema.safeParse({ from: '2025-01-01', to: '2026-02-01' }).success, false)
  assert.equal(reportQuerySchema.safeParse({ from: '2026-01-01', to: '2026-01-02', gridEmissionFactorKgPerKwh: 9 }).success, false)
})
