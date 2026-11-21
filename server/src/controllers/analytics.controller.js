import { Facility } from '../models/facility.model.js'
import { Meter } from '../models/meter.model.js'
import { EnergyReading } from '../models/energy-reading.model.js'

const startOfDay = (date) => {
  const value = new Date(date)
  value.setUTCHours(0, 0, 0, 0)
  return value
}

export async function getEnergyOverview(request, response) {
  const organization = request.organization._id
  const now = new Date()
  const to = request.validatedQuery.to ?? now
  const from = request.validatedQuery.from ?? new Date(now.getTime() - 6 * 86400000)
  const rangeStart = startOfDay(from)
  const rangeEnd = new Date(to)
  const dateMatch = { $gte: rangeStart, $lte: rangeEnd }

  const [facilityCount, activeFacilityCount, meterCount, activeMeterCount, totals, daily, facilities, quality] = await Promise.all([
    Facility.countDocuments({ organization }),
    Facility.countDocuments({ organization, status: 'active' }),
    Meter.countDocuments({ organization }),
    Meter.countDocuments({ organization, status: 'active' }),
    EnergyReading.aggregate([
      { $match: { organization, recordedAt: dateMatch } },
      { $group: {
        _id: null,
        totalEnergyKwh: { $sum: '$energyKwh' },
        peakDemandKw: { $max: '$demandKw' },
        averagePowerFactor: { $avg: '$powerFactor' },
        readingCount: { $sum: 1 },
      } },
    ]),
    EnergyReading.aggregate([
      { $match: { organization, recordedAt: dateMatch } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } },
        energyKwh: { $sum: '$energyKwh' },
        peakDemandKw: { $max: '$demandKw' },
        readingCount: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]),
    EnergyReading.aggregate([
      { $match: { organization, recordedAt: dateMatch } },
      { $group: {
        _id: '$facility',
        energyKwh: { $sum: '$energyKwh' },
        peakDemandKw: { $max: '$demandKw' },
        readingCount: { $sum: 1 },
      } },
      { $lookup: {
        from: 'facilities',
        localField: '_id',
        foreignField: '_id',
        as: 'facility',
      } },
      { $unwind: '$facility' },
      { $project: {
        _id: 0,
        facilityId: '$_id',
        name: '$facility.name',
        code: '$facility.code',
        energyKwh: 1,
        peakDemandKw: 1,
        readingCount: 1,
      } },
      { $sort: { energyKwh: -1 } },
      { $limit: 10 },
    ]),
    EnergyReading.aggregate([
      { $match: { organization, recordedAt: dateMatch } },
      { $group: {
        _id: '$quality',
        count: { $sum: 1 },
      } },
    ]),
  ])

  const summary = totals[0] ?? {
    totalEnergyKwh: 0,
    peakDemandKw: null,
    averagePowerFactor: null,
    readingCount: 0,
  }
  const qualityCounts = Object.fromEntries(quality.map((item) => [item._id, item.count]))
  response.json({
    data: {
      range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
      summary: {
        ...summary,
        activeFacilities: activeFacilityCount,
        totalFacilities: facilityCount,
        activeMeters: activeMeterCount,
        totalMeters: meterCount,
        flaggedReadings: qualityCounts.flagged ?? 0,
        estimatedReadings: qualityCounts.estimated ?? 0,
      },
      daily,
      facilities,
    },
  })
}
