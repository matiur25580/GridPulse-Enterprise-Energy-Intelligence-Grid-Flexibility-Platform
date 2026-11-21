import test from 'node:test'
import assert from 'node:assert/strict'
import { importMeterCsvSchema, reconcileInvoiceSchema } from '../src/schemas/integration.schema.js'

const id = '507f1f77bcf86cd799439011'

test('accepts bounded CSV batch import payloads', () => {
  const result = importMeterCsvSchema.safeParse({
    externalBatchId: 'gateway-batch-2026-11-01',
    fileName: 'meter-readings.csv',
    csv: 'externalId,recordedAt,energyKwh\nm1,2026-11-01T00:00:00Z,12.4',
  })
  assert.equal(result.success, true)
})

test('rejects missing import identifiers and oversized file names', () => {
  assert.equal(importMeterCsvSchema.safeParse({ fileName: 'meter.csv', csv: 'x' }).success, false)
  assert.equal(importMeterCsvSchema.safeParse({ externalBatchId: 'batch', fileName: 'x'.repeat(181), csv: 'x' }).success, false)
})

test('accepts utility invoice reconciliation inputs and defaults tolerance', () => {
  const result = reconcileInvoiceSchema.safeParse({
    facilityId: id, tariffId: id, invoiceNumber: 'INV-001', supplier: 'Utility Company',
    from: '2026-11-01', to: '2026-11-30', currency: 'INR',
    actualEnergyKwh: 1200, actualAmount: 9600,
  })
  assert.equal(result.success, true)
  if (result.success) assert.equal(result.data.tolerancePercent, 2)
})

test('rejects invalid dates, periods, negative amounts and unsupported currency', () => {
  const base = {
    facilityId: id, tariffId: id, invoiceNumber: 'INV-001', supplier: 'Utility Company',
    from: '2026-11-01', to: '2026-11-30', currency: 'INR',
    actualEnergyKwh: 1200, actualAmount: 9600,
  }
  assert.equal(reconcileInvoiceSchema.safeParse({ ...base, from: '2026-02-30' }).success, false)
  assert.equal(reconcileInvoiceSchema.safeParse({ ...base, from: '2026-12-01' }).success, false)
  assert.equal(reconcileInvoiceSchema.safeParse({ ...base, actualAmount: -1 }).success, false)
  assert.equal(reconcileInvoiceSchema.safeParse({ ...base, currency: 'XYZ' }).success, false)
})
