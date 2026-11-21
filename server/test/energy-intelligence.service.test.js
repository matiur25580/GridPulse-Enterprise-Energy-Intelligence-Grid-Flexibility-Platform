import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEnergyForecast, detectConsumptionAnomalies, evaluateEnergyForecast } from '../src/services/energy-intelligence.service.js'

test('forecast uses a seven-day baseline and returns bounded non-negative values', () => {
  const daily = Array.from({ length: 14 }, (_item, index) => ({
    _id: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    energyKwh: 100 + index,
  }))
  const result = buildEnergyForecast(daily, 7, new Date('2026-01-15T00:00:00.000Z'))
  assert.equal(result.forecast.length, 7)
  assert.equal(result.forecast[0].date, '2026-01-15')
  assert.ok(result.forecast.every((item) => item.energyKwh >= 0 && item.lowerKwh <= item.energyKwh && item.upperKwh >= item.energyKwh))
  assert.equal(result.model, 'seven-day-moving-average-with-capped-linear-trend')
})

test('anomaly detector flags a spike after sufficient per-meter history', () => {
  const rows = Array.from({ length: 10 }, (_item, index) => ({
    meterId: 'meter-1',
    facilityId: 'facility-1',
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    energyKwh: index === 9 ? 350 : 100,
  }))
  const result = detectConsumptionAnomalies(rows)
  assert.equal(result.length, 1)
  assert.equal(result[0].severity, 'high')
  assert.equal(result[0].baselineKwh, 100)
})

test('anomaly detector does not score meters with insufficient baseline history', () => {
  const rows = [{ meterId: 'meter-1', date: '2026-01-01', energyKwh: 500 }]
  assert.deepEqual(detectConsumptionAnomalies(rows), [])
})

test('anomaly detector evaluates each meter independently', () => {
  const rows = []
  for (const [meterId, baseline, finalValue] of [['meter-a', 10, 12], ['meter-b', 100, 300]]) {
    for (let index = 0; index < 9; index += 1) rows.push({
      meterId, facilityId: 'facility-1',
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      energyKwh: index === 8 ? finalValue : baseline,
    })
  }
  const result = detectConsumptionAnomalies(rows)
  assert.equal(result.length, 1)
  assert.equal(result[0].meterId, 'meter-b')
})

test('forecast backtest uses only prior contiguous observations and reports standard metrics', () => {
  const daily = Array.from({ length: 20 }, (_item, index) => ({
    _id: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    energyKwh: 100 + index,
  }))
  const result = evaluateEnergyForecast(daily, 7)
  assert.equal(result.evaluatedDays, 7)
  assert.ok(result.metrics.maeKwh >= 0)
  assert.ok(result.metrics.rmseKwh >= result.metrics.maeKwh)
  assert.ok(result.metrics.mapePercent >= 0)
  assert.equal(result.predictions[0].date, '2026-01-14')
  assert.equal(result.method, 'rolling-origin-one-day-ahead')
})

test('forecast backtest skips calendar gaps and does not bridge discontinuous training data', () => {
  const daily = Array.from({ length: 12 }, (_item, index) => ({
    _id: new Date(Date.UTC(2026, 0, index < 8 ? index + 1 : index + 2)).toISOString().slice(0, 10),
    energyKwh: 100 + index,
  }))
  const result = evaluateEnergyForecast(daily, 14)
  assert.equal(result.evaluatedDays, 1)
  assert.equal(result.predictions.some((item) => item.date === '2026-01-10'), false)
})

test('forecast backtest returns null metrics when there is insufficient history', () => {
  const result = evaluateEnergyForecast([{ _id: '2026-01-01', energyKwh: 50 }], 7)
  assert.equal(result.evaluatedDays, 0)
  assert.equal(result.metrics.maeKwh, null)
  assert.equal(result.metrics.mapePercent, null)
})


test('forecast backtest excludes zero-actual days from MAPE but includes them in error metrics', () => {
  const daily = Array.from({ length: 9 }, (_item, index) => ({
    _id: new Date(Date.UTC(2026, 1, index + 1)).toISOString().slice(0, 10),
    energyKwh: index === 7 ? 0 : 100,
  }))
  const result = evaluateEnergyForecast(daily, 7)

  assert.equal(result.evaluatedDays, 2)
  assert.equal(result.predictions[0].actualKwh, 0)
  assert.equal(result.predictions[0].absolutePercentageError, null)
  assert.equal(result.metrics.maeKwh, 50)
  assert.equal(result.metrics.rmseKwh, 70.711)
  assert.equal(result.metrics.mapePercent, 0)
  assert.equal(result.metrics.weightedAbsolutePercentageError, 100)
  assert.equal(result.metrics.meanErrorKwh, 50)
})

test('forecast backtest predictions do not use the target day or later observations', () => {
  const daily = Array.from({ length: 12 }, (_item, index) => ({
    _id: new Date(Date.UTC(2026, 2, index + 1)).toISOString().slice(0, 10),
    energyKwh: 80 + index,
  }))
  const changedFuture = daily.map((item, index) => ({
    ...item,
    energyKwh: index === 10 ? 9000 : item.energyKwh,
  }))

  const original = evaluateEnergyForecast(daily, 5)
  const changed = evaluateEnergyForecast(changedFuture, 5)
  assert.equal(original.evaluatedDays, 5)
  assert.deepEqual(
    changed.predictions.slice(0, -1).map((item) => item.predictedKwh),
    original.predictions.slice(0, -1).map((item) => item.predictedKwh),
  )
  assert.equal(changed.predictions.at(-1).predictedKwh, original.predictions.at(-1).predictedKwh)
})

test('forecast backtest reports errors for all-zero actuals while percentage metrics remain undefined', () => {
  const daily = Array.from({ length: 9 }, (_item, index) => ({
    _id: new Date(Date.UTC(2026, 3, index + 1)).toISOString().slice(0, 10),
    energyKwh: 0,
  }))
  const result = evaluateEnergyForecast(daily, 7)

  assert.equal(result.evaluatedDays, 2)
  assert.equal(result.metrics.maeKwh, 0)
  assert.equal(result.metrics.rmseKwh, 0)
  assert.equal(result.metrics.mapePercent, null)
  assert.equal(result.metrics.weightedAbsolutePercentageError, null)
})
