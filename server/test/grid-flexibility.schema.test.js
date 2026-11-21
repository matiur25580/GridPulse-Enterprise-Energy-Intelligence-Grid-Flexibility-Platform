import test from 'node:test'
import assert from 'node:assert/strict'
import { gridFlexibilityScenarioSchema } from '../src/schemas/grid-flexibility.schema.js'

test('accepts bounded demand response scenario inputs', () => {
  const result = gridFlexibilityScenarioSchema.safeParse({
    eventHours: [17, 18], reductionPercent: 15, incentivePerKwh: 1.5,
  })
  assert.equal(result.success, true)
  if (result.success) assert.equal(result.data.gridEmissionFactorKgPerKwh, 0.4)
})

test('rejects duplicate event hours and excessive curtailment', () => {
  assert.equal(gridFlexibilityScenarioSchema.safeParse({
    eventHours: [18, 18], reductionPercent: 15, incentivePerKwh: 1,
  }).success, false)
  assert.equal(gridFlexibilityScenarioSchema.safeParse({
    eventHours: [18], reductionPercent: 80, incentivePerKwh: 1,
  }).success, false)
})
