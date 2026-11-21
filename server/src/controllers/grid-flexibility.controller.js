import { EnergyReading } from '../models/energy-reading.model.js'
import { evaluateGridFlexibility } from '../services/grid-flexibility.service.js'
import { asyncHandler } from '../utils/async-handler.js'

export const runGridFlexibilityScenario = asyncHandler(async (request, response) => {
  const now = new Date()
  const { historyDays, ...scenario } = request.body
  const from = new Date(now.getTime() - historyDays * 86400000)
  const rows = await EnergyReading.aggregate([
    { $match: {
      organization: request.organization._id,
      recordedAt: { $gte: from, $lte: now },
      quality: { $in: ['valid', 'estimated'] },
    } },
    { $lookup: {
      from: 'meters',
      localField: 'meter',
      foreignField: '_id',
      as: 'meterInfo',
    } },
    { $unwind: '$meterInfo' },
    { $match: { 'meterInfo.status': 'active', 'meterInfo.meterType': { $in: ['main', 'submeter', 'solar'] } } },
    { $group: {
      _id: {
        date: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } },
        hour: { $hour: { date: '$recordedAt', timezone: 'UTC' } },
        meterType: '$meterInfo.meterType',
      },
      energyKwh: { $sum: '$energyKwh' },
    } },
    { $group: {
      _id: { hour: '$_id.hour', meterType: '$_id.meterType' },
      energyKwh: { $avg: '$energyKwh' },
      observedDays: { $sum: 1 },
    } },
    { $sort: { '_id.hour': 1 } },
  ])

  const hasMain = rows.some((row) => row._id.meterType === 'main')
  const loadSource = hasMain ? 'main' : 'submeter'
  const profile = Array.from({ length: 24 }, (_, hour) => {
    const load = rows.find((row) => row._id.hour === hour && row._id.meterType === loadSource)
    const solar = rows.find((row) => row._id.hour === hour && row._id.meterType === 'solar')
    return {
      hour,
      loadKwh: load?.energyKwh ?? 0,
      solarKwh: solar?.energyKwh ?? 0,
      observedLoad: Boolean(load),
      observedSolar: Boolean(solar),
    }
  })
  const result = evaluateGridFlexibility(profile, { ...scenario, loadSource })
  const observedDays = Math.max(0, ...rows.map((row) => row.observedDays))
  response.json({ data: {
    organizationId: String(request.organization._id),
    generatedAt: now.toISOString(),
    range: { from: from.toISOString(), to: now.toISOString(), requestedDays: historyDays },
    dataCoverage: {
      loadSource,
      hoursWithLoad: profile.filter((item) => item.observedLoad).length,
      hoursWithSolar: profile.filter((item) => item.observedSolar).length,
      observedDays,
      includedQuality: 'valid and estimated; flagged readings excluded',
    },
    ...result,
  } })
})
