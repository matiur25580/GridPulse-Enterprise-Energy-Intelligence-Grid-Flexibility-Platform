import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCosts } from '../src/services/billing.service.js'

const tariff = {
  currency: 'INR',
  defaultRatePerKwh: 8,
  demandChargePerKw: 100,
  fixedCharge: 10,
  taxRatePercent: 10,
  energyRates: [
    { label: 'Peak', ratePerKwh: 12, hours: [19], daysOfWeek: [1] },
    { label: 'Off peak', ratePerKwh: 5, hours: [1], daysOfWeek: [1] },
  ],
}
const rows = [
  { _id: { date: '2026-11-02', hour: 19, dayOfWeek: 1 }, energyKwh: 10, peakDemandKw: 4, averagePowerFactor: 0.96, readingCount: 1, estimatedReadings: 0 },
  { _id: { date: '2026-11-02', hour: 1, dayOfWeek: 1 }, energyKwh: 20, peakDemandKw: 2, averagePowerFactor: 0.98, readingCount: 1, estimatedReadings: 1 },
]

test('calculates time-of-use energy, measured demand, fixed charge and tax', () => {
  const result = calculateCosts(rows, tariff)
  assert.equal(result.summary.totalEnergyKwh, 30)
  assert.equal(result.summary.energyCharge, 220)
  assert.equal(result.summary.peakDemandKw, 4)
  assert.equal(result.summary.demandCharge, 400)
  assert.equal(result.summary.fixedCharge, 10)
  assert.equal(result.summary.subtotal, 630)
  assert.equal(result.summary.tax, 63)
  assert.equal(result.summary.total, 693)
  assert.equal(result.summary.readingCount, 2)
  assert.equal(result.summary.estimatedReadings, 1)
})

test('reports an illustrative rate-weighted shifting opportunity', () => {
  const result = calculateCosts(rows, tariff)
  const opportunity = result.insights.find((item) => item.includes('load-shifting opportunity'))
  assert.ok(opportunity)
  assert.match(opportunity, /7 INR/)
})

test('does not invent demand charges when measured kW is absent', () => {
  const noDemand = rows.map((row) => ({ ...row, peakDemandKw: null }))
  const result = calculateCosts(noDemand, tariff)
  assert.equal(result.summary.peakDemandKw, null)
  assert.equal(result.summary.demandCharge, 0)
  assert.ok(result.insights.some((item) => item.includes('no eligible measured kW telemetry exists')))
})
