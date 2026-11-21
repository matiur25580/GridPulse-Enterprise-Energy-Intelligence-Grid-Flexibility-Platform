import test from 'node:test'
import assert from 'node:assert/strict'
import { isAlertLeaseAvailable, nextAlertEvaluationAt } from '../src/utils/alert-scheduler.js'

test('alert lease is available when missing or expired', () => {
  const now = new Date('2026-11-21T12:00:00.000Z')
  assert.equal(isAlertLeaseAvailable(null, now), true)
  assert.equal(isAlertLeaseAvailable('2026-11-21T11:59:59.999Z', now), true)
  assert.equal(isAlertLeaseAvailable('2026-11-21T12:00:00.001Z', now), false)
})

test('next alert evaluation is calculated from the configured interval', () => {
  const now = new Date('2026-11-21T12:00:00.000Z')
  assert.equal(nextAlertEvaluationAt(now, 300).toISOString(), '2026-11-21T12:05:00.000Z')
  assert.equal(nextAlertEvaluationAt(now, 0).toISOString(), now.toISOString())
})
