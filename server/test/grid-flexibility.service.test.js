import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateGridFlexibility } from '../src/services/grid-flexibility.service.js'

const input = {
  eventHours: [18, 19],
  reductionPercent: 20,
  incentivePerKwh: 2,
  gridEmissionFactorKgPerKwh: 0.5,
  loadSource: 'main',
}

test('estimates solar self-consumption, surplus export, and demand response impact', () => {
  const profile = [
    { hour: 12, loadKwh: 5, solarKwh: 8, observedLoad: true, observedSolar: true },
    { hour: 18, loadKwh: 10, solarKwh: 0, observedLoad: true, observedSolar: true },
    { hour: 19, loadKwh: 5, solarKwh: 0, observedLoad: true, observedSolar: true },
  ]
  const result = evaluateGridFlexibility(profile, input)
  assert.equal(result.renewable.dailyGenerationKwh, 8)
  assert.equal(result.renewable.dailySelfConsumedKwh, 5)
  assert.equal(result.renewable.dailyEstimatedExportKwh, 3)
  assert.equal(result.demandResponse.dailyCurtailedKwh, 3)
  assert.equal(result.demandResponse.estimatedIncentive, 6)
  assert.equal(result.emissions.dailyAvoidedKgCo2e, 4)
})

test('returns null renewable ratios when solar generation is unavailable', () => {
  const result = evaluateGridFlexibility([{ hour: 18, loadKwh: 10 }], input)
  assert.equal(result.renewable.selfConsumptionPercent, null)
  assert.equal(result.renewable.solarCoveragePercent, null)
})

test('does not invent solar or load in missing hours', () => {
  const result = evaluateGridFlexibility([{ hour: 12, loadKwh: 4, solarKwh: 2, observedLoad: true, observedSolar: true }], input)
  const missing = result.schedule.find((item) => item.hourUtc === 2)
  assert.equal(missing.observedLoad, false)
  assert.equal(missing.observedSolar, false)
  assert.equal(missing.loadKwh, 0)
  assert.equal(missing.solarGenerationKwh, 0)
})

test('does not count unmatched solar hours as self-consumption or grid export', () => {
  const result = evaluateGridFlexibility([
    { hour: 12, loadKwh: 0, solarKwh: 8, observedLoad: false, observedSolar: true },
    { hour: 18, loadKwh: 6, solarKwh: 0, observedLoad: true, observedSolar: false },
  ], input)
  assert.equal(result.renewable.dailyGenerationKwh, 8)
  assert.equal(result.renewable.dailySelfConsumedKwh, 0)
  assert.equal(result.renewable.dailyEstimatedExportKwh, 0)
  assert.equal(result.renewable.selfConsumptionPercent, null)
  assert.equal(result.demandResponse.dailyBaselineGridImportKwh, 6)
})
