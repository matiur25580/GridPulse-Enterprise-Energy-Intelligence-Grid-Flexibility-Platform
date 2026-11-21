import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createFacilitySchema,
  createMeterSchema,
  ingestReadingsSchema,
  listReadingsQuerySchema,
} from '../src/schemas/asset.schema.js'

test('facility schema applies safe defaults and validates a facility code', () => {
  const result = createFacilitySchema.parse({ name: 'Plant One', code: 'plant_01' })
  assert.equal(result.facilityType, 'other')
  assert.equal(result.timezone, 'UTC')
})

test('meter schema rejects an invalid facility identifier', () => {
  const result = createMeterSchema.safeParse({
    facilityId: 'not-an-object-id',
    name: 'Main Meter',
    serialNumber: 'M-100',
  })
  assert.equal(result.success, false)
})

test('reading ingestion rejects duplicate event identifiers in one batch', () => {
  const reading = {
    externalId: 'event-1',
    recordedAt: '2026-11-20T12:00:00.000Z',
    energyKwh: 12.4,
  }
  const result = ingestReadingsSchema.safeParse({ readings: [reading, reading] })
  assert.equal(result.success, false)
})

test('reading ingestion rejects negative energy values', () => {
  const result = ingestReadingsSchema.safeParse({
    readings: [{ externalId: 'event-2', recordedAt: '2026-11-20T12:00:00.000Z', energyKwh: -2 }],
  })
  assert.equal(result.success, false)
})

test('reading query rejects inverted time ranges', () => {
  const result = listReadingsQuerySchema.safeParse({
    from: '2026-11-21T00:00:00.000Z',
    to: '2026-11-01T00:00:00.000Z',
  })
  assert.equal(result.success, false)
})

test('reading query applies pagination defaults', () => {
  const result = listReadingsQuerySchema.parse({})
  assert.equal(result.page, 1)
  assert.equal(result.limit, 100)
})
