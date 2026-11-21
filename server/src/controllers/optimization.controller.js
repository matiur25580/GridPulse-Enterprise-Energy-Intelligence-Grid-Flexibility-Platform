import { EnergyReading } from '../models/energy-reading.model.js'
import { simulateEnergyOptimization } from '../services/energy-optimization.service.js'
import { asyncHandler } from '../utils/async-handler.js'

export const runOptimizationScenario = asyncHandler(async (request, response) => {
  const now = new Date()
  const { historyDays, ...scenario } = request.validatedBody
  const from = new Date(now.getTime() - historyDays * 86400000)
  const rows = await EnergyReading.aggregate([
    {
      $match: {
        organization: request.organization._id,
        recordedAt: { $gte: from, $lte: now },
        quality: { $in: ['valid', 'estimated'] },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } },
          hour: { $hour: { date: '$recordedAt', timezone: 'UTC' } },
        },
        energyKwh: { $sum: '$energyKwh' },
        demandKw: { $max: '$demandKw' },
      },
    },
    {
      $group: {
        _id: '$_id.hour',
        energyKwh: { $avg: '$energyKwh' },
        demandKw: { $avg: '$demandKw' },
        observedDays: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ])

  const hourlyProfile = rows.map((item) => ({
    hour: item._id,
    energyKwh: item.energyKwh,
    demandKw: item.demandKw,
    observedDays: item.observedDays,
  }))
  const result = simulateEnergyOptimization(hourlyProfile, scenario)
  const observedDays = Math.max(0, ...rows.map((item) => item.observedDays))
  response.json({
    data: {
      organizationId: String(request.organization._id),
      generatedAt: now.toISOString(),
      range: { from: from.toISOString(), to: now.toISOString(), requestedDays: historyDays },
      dataCoverage: {
        hoursWithReadings: hourlyProfile.length,
        observedDays,
        readingQuality: 'valid and estimated readings; flagged readings excluded',
      },
      ...result,
    },
  })
})
