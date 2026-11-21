import test from 'node:test'
import assert from 'node:assert/strict'
import { createGatewaySourceSchema, gatewayEventsSchema } from '../src/schemas/gateway.schema.js'

const id = '507f1f77bcf86cd799439011'

test('accepts a mapped gateway source and bounded event batch', () => {
  assert.equal(createGatewaySourceSchema.safeParse({ name: 'Plant gateway', meterMappings: [{ externalMeterId: 'gw-meter-1', meterId: id }] }).success, true)
  assert.equal(gatewayEventsSchema.safeParse({ events: [{ eventId: 'evt-1', externalMeterId: 'gw-meter-1', recordedAt: '2026-11-21T10:00:00Z', energyKwh: 12.5 }] }).success, true)
})

test('rejects duplicate gateway mappings and invalid expected intervals', () => {
  assert.equal(createGatewaySourceSchema.safeParse({ name: 'Plant gateway', meterMappings: [{ externalMeterId: 'x', meterId: id }, { externalMeterId: 'x', meterId: '507f191e810c19729de860ea' }] }).success, false)
  assert.equal(createGatewaySourceSchema.safeParse({ name: 'Plant gateway', expectedIntervalMinutes: 0, meterMappings: [{ externalMeterId: 'x', meterId: id }] }).success, false)
})

test('rejects timezone-naive, invalid and oversized event payloads', () => {
  assert.equal(gatewayEventsSchema.safeParse({ events: [{ eventId: 'evt', externalMeterId: 'm', recordedAt: '2026-11-21T10:00:00', energyKwh: 1 }] }).success, false)
  assert.equal(gatewayEventsSchema.safeParse({ events: [{ eventId: 'evt', externalMeterId: 'm', recordedAt: '2026-11-21T10:00:00Z', energyKwh: -1 }] }).success, false)
  assert.equal(gatewayEventsSchema.safeParse({ events: Array.from({ length: 501 }, (_, index) => ({ eventId: String(index), externalMeterId: 'm', recordedAt: '2026-11-21T10:00:00Z', energyKwh: 1 })) }).success, false)
})

test('rejects duplicate event identifiers within one external meter batch', () => {
  const event = { eventId: 'same-event', externalMeterId: 'meter-a', recordedAt: '2026-11-21T10:00:00Z', energyKwh: 2 }
  assert.equal(gatewayEventsSchema.safeParse({ events: [event, event] }).success, false)
  assert.equal(gatewayEventsSchema.safeParse({ events: [event, { ...event, externalMeterId: 'meter-b' }] }).success, true)
})

test('rejects readings timestamped more than five minutes in the future', () => {
  const future = new Date(Date.now() + 6 * 60 * 1000).toISOString()
  const recent = new Date(Date.now() + 4 * 60 * 1000).toISOString()
  const base = { eventId: 'evt-future', externalMeterId: 'gw-meter-1', energyKwh: 1 }
  assert.equal(gatewayEventsSchema.safeParse({ events: [{ ...base, recordedAt: future }] }).success, false)
  assert.equal(gatewayEventsSchema.safeParse({ events: [{ ...base, recordedAt: recent }] }).success, true)
})
