import test from 'node:test'
import assert from 'node:assert/strict'
import { createTariffSchema, estimateBillSchema } from '../src/schemas/billing.schema.js'

const validTariff = {
  facilityId: '507f1f77bcf86cd799439011',
  name: 'Commercial time of use',
  currency: 'INR',
  defaultRatePerKwh: 8.5,
  energyRates: [
    { label: 'Peak', ratePerKwh: 12, hours: [18, 19, 20], daysOfWeek: [1, 2, 3, 4, 5] },
    { label: 'Off peak', ratePerKwh: 5, hours: [0, 1, 2, 3, 4, 5], daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
  ],
  demandChargePerKw: 250,
  fixedCharge: 500,
  taxRatePercent: 5,
  effectiveFrom: '2026-01-01',
}

test('accepts bounded tariff plans and applies optional defaults', () => {
  const parsed = createTariffSchema.safeParse(validTariff)
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.currency, 'INR')
    assert.equal(parsed.data.taxRatePercent, 5)
  }
})

test('rejects overlapping TOU hours on the same weekday and invalid rates', () => {
  const overlapping = { ...validTariff, energyRates: [
    { label: 'Peak', ratePerKwh: 12, hours: [18, 19], daysOfWeek: [1, 2] },
    { label: 'Evening', ratePerKwh: 10, hours: [19, 20], daysOfWeek: [2] },
  ] }
  assert.equal(createTariffSchema.safeParse(overlapping).success, false)
  assert.equal(createTariffSchema.safeParse({ ...validTariff, defaultRatePerKwh: -1 }).success, false)
  assert.equal(createTariffSchema.safeParse({ ...validTariff, effectiveTo: '2025-12-31' }).success, false)
  assert.equal(createTariffSchema.safeParse({ ...validTariff, effectiveFrom: '2026-02-30' }).success, false)
})

test('accepts date-bounded estimates and rejects reversed or oversized periods', () => {
  const base = { facilityId: validTariff.facilityId, tariffId: '507f1f77bcf86cd799439012', from: '2026-01-01', to: '2026-01-31' }
  assert.equal(estimateBillSchema.safeParse(base).success, true)
  assert.equal(estimateBillSchema.safeParse({ ...base, from: '2026-02-01' }).success, false)
  assert.equal(estimateBillSchema.safeParse({ ...base, to: '2027-02-02' }).success, false)
  assert.equal(estimateBillSchema.safeParse({ ...base, to: '2027-01-02' }).success, false)
  assert.equal(estimateBillSchema.safeParse({ ...base, from: '2026-02-30' }).success, false)
})
