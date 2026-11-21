import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateEnergyOptimization } from '../src/services/energy-optimization.service.js'

const input = {
  peakHours: [17, 18, 19, 20],
  offPeakRatePerKwh: 5,
  peakRatePerKwh: 12,
  batteryCapacityKwh: 20,
  batteryPowerKw: 5,
  initialSocPercent: 20,
  reserveSocPercent: 10,
  roundTripEfficiency: 0.9,
}

test('estimates time-of-use cost and battery peak shifting within configured limits', () => {
  const profile = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    energyKwh: hour >= 17 && hour <= 20 ? 8 : 2,
    demandKw: hour >= 17 && hour <= 20 ? 8 : 2,
  }))
  const result = simulateEnergyOptimization(profile, input)
  assert.equal(result.schedule.length, 24)
  assert.ok(result.optimized.batteryChargeKwh <= 20)
  assert.ok(result.optimized.batteryDischargeKwh <= 20)
  assert.ok(result.optimized.endingStateOfChargeKwh >= 2)
  assert.ok(result.impact.dailyCostSavings > 0)
  assert.ok(result.impact.peakReductionKw > 0)
})

test('does not dispatch a battery when storage is not configured', () => {
  const profile = [{ hour: 18, energyKwh: 10, demandKw: 10 }]
  const result = simulateEnergyOptimization(profile, {
    ...input, batteryCapacityKwh: 0, batteryPowerKw: 0,
  })
  assert.equal(result.optimized.batteryChargeKwh, 0)
  assert.equal(result.optimized.batteryDischargeKwh, 0)
  assert.equal(result.impact.dailyCostSavings, 0)
})

test('does not discharge below the configured reserve', () => {
  const profile = [{ hour: 18, energyKwh: 20, demandKw: 20 }]
  const result = simulateEnergyOptimization(profile, {
    ...input, initialSocPercent: 30, reserveSocPercent: 25,
  })
  assert.ok(result.optimized.endingStateOfChargeKwh >= 5)
})
