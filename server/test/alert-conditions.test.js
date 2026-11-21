import test from 'node:test'
import assert from 'node:assert/strict'
import { exceedsEnergyThreshold, isAlertStale } from '../src/utils/alert-conditions.js'

const now = new Date('2026-11-21T12:00:00.000Z')

test('triggers only when observed energy strictly exceeds the configured threshold', () => {
  assert.equal(exceedsEnergyThreshold(10.1, 10), true)
  assert.equal(exceedsEnergyThreshold(10, 10), false)
  assert.equal(exceedsEnergyThreshold(9.9, 10), false)
  assert.equal(exceedsEnergyThreshold(Number.NaN, 10), false)
})

test('treats missing telemetry as stale and respects the configured silence window', () => {
  assert.equal(isAlertStale(null, 15, now), true)
  assert.equal(isAlertStale('2026-11-21T11:50:00.000Z', 15, now), false)
  assert.equal(isAlertStale('2026-11-21T11:44:00.000Z', 15, now), true)
})
