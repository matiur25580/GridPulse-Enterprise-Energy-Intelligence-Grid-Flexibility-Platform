import { EnergyReading } from '../models/energy-reading.model.js'

const round = (value, digits = 2) => Number(value.toFixed(digits))

export async function buildEnergyReport({ organizationId, from, to, gridEmissionFactorKgPerKwh }) {
  const match = { organization: organizationId, recordedAt: { $gte: from, $lte: to } }
  const [totals, daily, facilities, meters, quality] = await Promise.all([
    EnergyReading.aggregate([
      { $match: { ...match, quality: { $in: ['valid', 'estimated'] } } },
      { $group: { _id: null, totalEnergyKwh: { $sum: '$energyKwh' }, peakDemandKw: { $max: '$demandKw' }, averagePowerFactor: { $avg: '$powerFactor' }, includedReadings: { $sum: 1 } } },
    ]),
    EnergyReading.aggregate([
      { $match: { ...match, quality: { $in: ['valid', 'estimated'] } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } }, energyKwh: { $sum: '$energyKwh' }, peakDemandKw: { $max: '$demandKw' }, readingCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    EnergyReading.aggregate([
      { $match: { ...match, quality: { $in: ['valid', 'estimated'] } } },
      { $group: { _id: '$facility', energyKwh: { $sum: '$energyKwh' }, peakDemandKw: { $max: '$demandKw' }, readingCount: { $sum: 1 } } },
      { $lookup: { from: 'facilities', localField: '_id', foreignField: '_id', as: 'facility' } },
      { $unwind: '$facility' },
      { $project: { _id: 0, facilityId: { $toString: '$_id' }, name: '$facility.name', code: '$facility.code', energyKwh: 1, peakDemandKw: 1, readingCount: 1 } },
      { $sort: { energyKwh: -1 } },
    ]),
    EnergyReading.aggregate([
      { $match: match },
      { $group: { _id: { meter: '$meter', quality: '$quality' }, energyKwh: { $sum: '$energyKwh' }, readingCount: { $sum: 1 } } },
      { $lookup: { from: 'meters', localField: '_id.meter', foreignField: '_id', as: 'meter' } },
      { $unwind: '$meter' },
      { $project: { _id: 0, meterId: { $toString: '$_id.meter' }, meterName: '$meter.name', serialNumber: '$meter.serialNumber', meterType: '$meter.meterType', quality: '$_id.quality', energyKwh: 1, readingCount: 1 } },
      { $sort: { meterName: 1, quality: 1 } },
    ]),
    EnergyReading.aggregate([
      { $match: match },
      { $group: { _id: '$quality', readingCount: { $sum: 1 }, energyKwh: { $sum: '$energyKwh' } } },
    ]),
  ])

  const summary = totals[0] ?? { totalEnergyKwh: 0, peakDemandKw: null, averagePowerFactor: null, includedReadings: 0 }
  const qualitySummary = Object.fromEntries(quality.map((item) => [item._id, { readingCount: item.readingCount, energyKwh: round(item.energyKwh) }]))
  const dayCount = Math.max(1, Math.ceil((to.getTime() - from.getTime() + 1) / 86400000))
  const energy = summary.totalEnergyKwh
  return {
    generatedAt: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString(), timezone: 'UTC', dayCount },
    summary: {
      totalEnergyKwh: round(energy),
      averageDailyEnergyKwh: round(energy / dayCount),
      peakDemandKw: summary.peakDemandKw == null ? null : round(summary.peakDemandKw),
      averagePowerFactor: summary.averagePowerFactor == null ? null : round(summary.averagePowerFactor, 4),
      includedReadings: summary.includedReadings,
      estimatedReadings: qualitySummary.estimated?.readingCount ?? 0,
      flaggedReadings: qualitySummary.flagged?.readingCount ?? 0,
      excludedFlaggedEnergyKwh: qualitySummary.flagged?.energyKwh ?? 0,
      estimatedEmissionsKgCo2e: round(energy * gridEmissionFactorKgPerKwh, 3),
    },
    emissions: {
      gridEmissionFactorKgPerKwh,
      estimatedKgCo2e: round(energy * gridEmissionFactorKgPerKwh, 3),
      methodology: 'Estimated location-based emissions = included electricity consumption × user-supplied grid emissions factor. This is an indicative estimate, not a verified inventory or regulatory disclosure.',
    },
    dataQuality: {
      included: 'valid and estimated readings',
      flagged: 'flagged readings are excluded from consumption, demand, and emissions totals',
      byQuality: qualitySummary,
    },
    daily: daily.map((item) => ({ date: item._id, energyKwh: round(item.energyKwh), peakDemandKw: item.peakDemandKw == null ? null : round(item.peakDemandKw), readingCount: item.readingCount })),
    facilities: facilities.map((item) => ({ ...item, energyKwh: round(item.energyKwh), peakDemandKw: item.peakDemandKw == null ? null : round(item.peakDemandKw) })),
    meters: meters.map((item) => ({ ...item, energyKwh: round(item.energyKwh) })),
  }
}
