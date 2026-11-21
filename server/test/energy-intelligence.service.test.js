import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEnergyForecast, detectConsumptionAnomalies } from '../src/services/energy-intelligence.service.js'

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
