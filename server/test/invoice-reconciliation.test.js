import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateInvoiceReconciliation } from '../src/utils/invoice-reconciliation.js'

const base = {
  actualAmount: 1050, estimatedAmount: 1000,
  actualEnergyKwh: 125, estimatedEnergyKwh: 120,
  actualDemandKw: 52, estimatedDemandKw: 50,
  currency: 'INR', tolerancePercent: 2,
}

test('flags amount and energy variance above configured tolerance', () => {
  const result = calculateInvoiceReconciliation(base)
  assert.equal(result.status, 'discrepancy')
  assert.equal(result.amountVariance, 50)
  assert.equal(result.amountVariancePercent, 5)
  assert.equal(result.energyVarianceKwh, 5)
  assert.equal(result.demandVarianceKw, 2)
})

test('accepts variance exactly on tolerance boundary', () => {
  const result = calculateInvoiceReconciliation({ ...base, actualAmount: 1020 })
  assert.equal(result.status, 'within_tolerance')
})

test('does not fabricate percentage or demand variance when comparison data is unavailable', () => {
  const result = calculateInvoiceReconciliation({ ...base, estimatedAmount: 0, estimatedDemandKw: null, actualDemandKw: 44 })
  assert.equal(result.amountVariancePercent, null)
  assert.equal(result.status, 'discrepancy')
  assert.equal(result.demandVarianceKw, null)
  assert.ok(result.notes.some((note) => note.includes('Percentage variance is unavailable')))
  assert.ok(result.notes.some((note) => note.includes('Demand comparison is unavailable')))
})

test('treats matching zero-value estimates as within tolerance without percentage division', () => {
  const result = calculateInvoiceReconciliation({ ...base, actualAmount: 0, estimatedAmount: 0, actualEnergyKwh: 0, estimatedEnergyKwh: 0 })
  assert.equal(result.status, 'within_tolerance')
  assert.equal(result.amountVariancePercent, null)
})
