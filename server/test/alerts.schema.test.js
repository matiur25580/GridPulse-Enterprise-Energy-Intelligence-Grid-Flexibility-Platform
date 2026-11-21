import test from 'node:test'
import assert from 'node:assert/strict'
import { createAlertRuleSchema, listIncidentsQuerySchema, updateIncidentSchema } from '../src/schemas/alerts.schema.js'

const id = '507f1f77bcf86cd799439011'

test('requires a positive energy threshold for high-consumption rules', () => {
  assert.equal(createAlertRuleSchema.safeParse({ name: 'Peak watch', type: 'high_consumption', targetId: id, thresholdKwh: 12 }).success, true)
  assert.equal(createAlertRuleSchema.safeParse({ name: 'Peak watch', type: 'high_consumption', targetId: id }).success, false)
  assert.equal(createAlertRuleSchema.safeParse({ name: 'Peak watch', type: 'high_consumption', targetId: id, thresholdKwh: 0 }).success, false)
})

test('validates rule intervals, target IDs and severities', () => {
  assert.equal(createAlertRuleSchema.safeParse({ name: 'Meter silence', type: 'meter_silent', targetId: id, staleAfterMinutes: 30, severity: 'high' }).success, true)
  assert.equal(createAlertRuleSchema.safeParse({ name: 'Meter silence', type: 'meter_silent', targetId: 'invalid' }).success, false)
  assert.equal(createAlertRuleSchema.safeParse({ name: 'Meter silence', type: 'meter_silent', targetId: id, staleAfterMinutes: 2 }).success, false)
})

test('bounds incident filters and only allows forward incident transitions', () => {
  assert.equal(listIncidentsQuerySchema.safeParse({ status: 'open', severity: 'critical', limit: '50' }).success, true)
  assert.equal(listIncidentsQuerySchema.safeParse({ limit: '999' }).success, false)
  assert.equal(updateIncidentSchema.safeParse({ status: 'acknowledged' }).success, true)
  assert.equal(updateIncidentSchema.safeParse({ status: 'open' }).success, false)
})
