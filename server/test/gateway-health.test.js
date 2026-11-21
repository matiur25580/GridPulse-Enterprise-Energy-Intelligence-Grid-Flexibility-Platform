import test from 'node:test'
import assert from 'node:assert/strict'
import { gatewayHealth } from '../src/utils/gateway-health.js'

const now = new Date('2026-11-21T12:00:00.000Z')

test('reports a source awaiting its first successful delivery', () => {
  assert.deepEqual(gatewayHealth({ status: 'active', lastSuccessAt: null, expectedIntervalMinutes: 15 }, now), { health: 'awaiting_data', minutesSinceLastSuccess: null })
})

test('marks a source healthy within three expected reporting intervals', () => {
  const result = gatewayHealth({ status: 'active', lastSuccessAt: '2026-11-21T11:30:00.000Z', expectedIntervalMinutes: 15 }, now)
  assert.equal(result.health, 'healthy')
  assert.equal(result.minutesSinceLastSuccess, 30)
})

test('marks a source stale beyond its reporting threshold', () => {
  const result = gatewayHealth({ status: 'active', lastSuccessAt: '2026-11-21T11:14:00.000Z', expectedIntervalMinutes: 15 }, now)
  assert.equal(result.health, 'stale')
  assert.equal(result.minutesSinceLastSuccess, 46)
})

test('disabled state takes precedence over freshness', () => {
  assert.equal(gatewayHealth({ status: 'disabled', lastSuccessAt: '2026-11-21T11:59:00.000Z', expectedIntervalMinutes: 15 }, now).health, 'disabled')
})
