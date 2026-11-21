import { EnergyReading } from '../models/energy-reading.model.js'
import { Meter } from '../models/meter.model.js'
import { Facility } from '../models/facility.model.js'
import { buildEnergyForecast, detectConsumptionAnomalies, evaluateEnergyForecast } from '../services/energy-intelligence.service.js'
import { asyncHandler } from '../utils/async-handler.js'

const startOfUtcDay = (date) => {
  const value = new Date(date)
  value.setUTCHours(0, 0, 0, 0)
  return value
}

export const getEnergyIntelligence = asyncHandler(async (request, response) => {
  const now = new Date()
  const today = startOfUtcDay(now)
  const historyDays = request.validatedQuery.historyDays
  const horizonDays = request.validatedQuery.horizonDays
  const backtestDays = request.validatedQuery.backtestDays
  const from = new Date(today.getTime() - (historyDays - 1) * 86400000)
  const organization = request.organization._id
  const match = {
    organization,
    recordedAt: { $gte: from, $lt: new Date(today.getTime() + 86400000) },
    quality: { $in: ['valid', 'estimated'] },
  }

  const [daily, meterDaily, facilityDaily] = await Promise.all([
    EnergyReading.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } },
        energyKwh: { $sum: '$energyKwh' },
        readingCount: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
    ]),
    EnergyReading.aggregate([
      { $match: match },
      { $group: {
        _id: {
          meterId: '$meter',
          facilityId: '$facility',
          date: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } },
        },
        energyKwh: { $sum: '$energyKwh' },
        readingCount: { $sum: 1 },
      } },
      { $project: {
        _id: 0,
        meterId: '$_id.meterId',
        facilityId: '$_id.facilityId',
        date: '$_id.date',
        energyKwh: 1,
        readingCount: 1,
      } },
      { $sort: { meterId: 1, date: 1 } },
    ]),
    EnergyReading.aggregate([
      { $match: match },
      { $group: { _id: { facilityId: '$facility', date: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone: 'UTC' } } }, energyKwh: { $sum: '$energyKwh' } } },
      { $sort: { '_id.facilityId': 1, '_id.date': 1 } },
    ]),
  ])

  const facilityIds = [...new Set(facilityDaily.map((item) => String(item._id.facilityId)))]
  const facilities = facilityIds.length ? await Facility.find({ _id: { $in: facilityIds }, organization }).select('name code').lean() : []
  const facilityLookup = new Map(facilities.map((item) => [String(item._id), item]))
  const detected = detectConsumptionAnomalies(meterDaily)
  const meterIds = [...new Set(detected.map((item) => String(item.meterId)))]
  const meters = meterIds.length
    ? await Meter.find({ _id: { $in: meterIds }, organization }).select('name serialNumber facility').lean()
    : []
  const meterLookup = new Map(meters.map((meter) => [String(meter._id), meter]))
  const anomalies = detected.map((item) => {
    const meter = meterLookup.get(String(item.meterId))
    return {
      ...item,
      meter: meter ? { id: meter._id, name: meter.name, serialNumber: meter.serialNumber } : null,
    }
  })

  response.json({
    data: {
      range: { from: from.toISOString(), to: now.toISOString() },
      generatedAt: now.toISOString(),
      history: daily.map((item) => ({ date: item._id, energyKwh: Number(Number(item.energyKwh).toFixed(3)), readingCount: item.readingCount })),
      forecast: buildEnergyForecast(daily, horizonDays, now),
      backtest: evaluateEnergyForecast(daily, backtestDays),
      facilityBacktests: [...new Set(facilityDaily.map((item) => String(item._id.facilityId)))].map((facilityId) => ({
        facilityId,
        facility: facilityLookup.has(facilityId) ? { name: facilityLookup.get(facilityId).name, code: facilityLookup.get(facilityId).code } : null,
        ...evaluateEnergyForecast(facilityDaily.filter((item) => String(item._id.facilityId) === facilityId).map((item) => ({ _id: item._id.date, energyKwh: item.energyKwh })), backtestDays),
      })),
      anomalies,
      anomalySummary: {
        count: anomalies.length,
        high: anomalies.filter((item) => item.severity === 'high').length,
        medium: anomalies.filter((item) => item.severity === 'medium').length,
      },
      dataQuality: {
        included: 'valid, estimated',
        excluded: 'flagged',
        historyDays,
        horizonDays,
        backtestDays,
      },
    },
  })
})
