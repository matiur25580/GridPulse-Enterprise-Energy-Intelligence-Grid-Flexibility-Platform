import test from 'node:test'
import assert from 'node:assert/strict'
import { optimizationParamsSchema, optimizationScenarioSchema } from '../src/schemas/optimization.schema.js'

test('accepts a valid organization identifier and bounded tariff scenario', () => {
  const params = optimizationParamsSchema.safeParse({ organizationId: '507f1f77bcf86cd799439011' })
  const scenario = optimizationScenarioSchema.safeParse({
    offPeakRatePerKwh: 4,
    peakRatePerKwh: 10,
    peakHours: [18, 19, 20],
  })
  assert.equal(params.success, true)
  assert.equal(scenario.success, true)
  if (scenario.success) {
    assert.equal(scenario.data.historyDays, 30)
    assert.equal(scenario.data.batteryCapacityKwh, 0)
  }
})

test('rejects duplicate peak hours and impossible battery reserve settings', () => {
  const duplicate = optimizationScenarioSchema.safeParse({
    offPeakRatePerKwh: 4, peakRatePerKwh: 10, peakHours: [18, 18],
  })
  const reserve = optimizationScenarioSchema.safeParse({
    offPeakRatePerKwh: 4, peakRatePerKwh: 10, peakHours: [18],
    batteryCapacityKwh: 100, batteryPowerKw: 20,
    initialSocPercent: 20, reserveSocPercent: 30,
  })
  assert.equal(duplicate.success, false)
  assert.equal(reserve.success, false)
})
