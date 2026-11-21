import { EnergyReading } from '../models/energy-reading.model.js'
import { Facility } from '../models/facility.model.js'
import { TariffPlan } from '../models/tariff-plan.model.js'
import { EnergyBill } from '../models/energy-bill.model.js'
import { AppError } from '../utils/app-error.js'

const DAY_MS = 86400000
const round = (value, digits = 2) => Number(value.toFixed(digits))
const dayBefore = (dateString, days) => new Date(Date.parse(dateString + 'T00:00:00.000Z') - days * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (from, to) => Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS) + 1

async function hourlyReadings({ organizationId, facilityId, from, to, timezone }) {
  const start = new Date(Date.parse(from + 'T00:00:00.000Z') - DAY_MS)
  const end = new Date(Date.parse(to + 'T23:59:59.999Z') + DAY_MS)
  const aggregateFor = (meterTypes) => EnergyReading.aggregate([
    { $match: { organization: organizationId, facility: facilityId, recordedAt: { $gte: start, $lte: end }, quality: { $in: ['valid', 'estimated'] } } },
    { $lookup: { from: 'meters', let: { meterId: '$meter' }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ['$_id', '$$meterId'] }, { $eq: ['$organization', organizationId] }, { $eq: ['$facility', facilityId] }, { $eq: ['$status', 'active'] }, { $in: ['$meterType', meterTypes] }] } } },
      { $project: { _id: 1, meterType: 1 } },
    ], as: 'meterInfo' } },
    { $unwind: '$meterInfo' },
    { $project: {
      localDate: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt', timezone } },
      hour: { $hour: { date: '$recordedAt', timezone } },
      dayOfWeek: { $subtract: [{ $dayOfWeek: { date: '$recordedAt', timezone } }, 1] },
      energyKwh: 1, demandKw: 1, powerFactor: 1, quality: 1,
    } },
    { $match: { localDate: { $gte: from, $lte: to } } },
    { $group: {
      _id: { date: '$localDate', hour: '$hour', dayOfWeek: '$dayOfWeek' },
      energyKwh: { $sum: '$energyKwh' },
      peakDemandKw: { $max: '$demandKw' },
      averagePowerFactor: { $avg: '$powerFactor' },
      readingCount: { $sum: 1 },
      estimatedReadings: { $sum: { $cond: [{ $eq: ['$quality', 'estimated'] }, 1, 0] } },
    } },
    { $sort: { '_id.date': 1, '_id.hour': 1 } },
  ])
  const main = await aggregateFor(['main'])
  if (main.length) return { rows: main, source: 'main' }
  const submeter = await aggregateFor(['submeter'])
  return { rows: submeter, source: submeter.length ? 'submeter_fallback' : 'none' }
}

function rateFor(tariff, hour, dayOfWeek) {
  const match = tariff.energyRates.find((rate) => rate.hours.includes(hour) && rate.daysOfWeek.includes(dayOfWeek))
  return { rate: match?.ratePerKwh ?? tariff.defaultRatePerKwh, label: match?.label ?? 'Default rate' }
}

function calculateCosts(rows, tariff) {
  const dailyMap = new Map()
  let energyKwh = 0
  let energyCharge = 0
  let peakDemandKw = null
  let powerFactorTotal = 0
  let powerFactorSamples = 0
  let readingCount = 0
  let estimatedReadings = 0
  let higherRateEnergyKwh = 0
  const configuredRates = [tariff.defaultRatePerKwh, ...tariff.energyRates.map((item) => item.ratePerKwh)]
  const lowestRate = Math.min(...configuredRates)
  const highestRate = Math.max(...configuredRates)
  for (const row of rows) {
    const { rate } = rateFor(tariff, row._id.hour, row._id.dayOfWeek)
    const charge = row.energyKwh * rate
    energyKwh += row.energyKwh
    energyCharge += charge
    if (row.peakDemandKw != null) peakDemandKw = Math.max(peakDemandKw ?? 0, row.peakDemandKw)
    if (row.averagePowerFactor != null) { powerFactorTotal += row.averagePowerFactor; powerFactorSamples += 1 }
    readingCount += row.readingCount
    estimatedReadings += row.estimatedReadings
    if (rate > lowestRate) higherRateEnergyKwh += row.energyKwh
    const daily = dailyMap.get(row._id.date) ?? { date: row._id.date, energyKwh: 0, energyCharge: 0, demandKw: null, readingCount: 0 }
    daily.energyKwh += row.energyKwh
    daily.energyCharge += charge
    daily.demandKw = row.peakDemandKw == null ? daily.demandKw : Math.max(daily.demandKw ?? 0, row.peakDemandKw)
    daily.readingCount += row.readingCount
    dailyMap.set(row._id.date, daily)
  }
  const demandCharge = peakDemandKw == null ? 0 : peakDemandKw * tariff.demandChargePerKw
  const fixedCharge = tariff.fixedCharge
  const subtotal = energyCharge + demandCharge + fixedCharge
  const tax = subtotal * tariff.taxRatePercent / 100
  const total = subtotal + tax
  const shiftableEnergyKwh = higherRateEnergyKwh * 0.1
  const potentialShiftSavings = shiftableEnergyKwh * Math.max(0, highestRate - lowestRate)
  const daily = [...dailyMap.values()].map((item) => ({
    ...item,
    energyKwh: round(item.energyKwh),
    energyCharge: round(item.energyCharge),
    demandKw: item.demandKw == null ? null : round(item.demandKw),
  }))
  return {
    summary: {
      totalEnergyKwh: round(energyKwh), energyCharge: round(energyCharge),
      peakDemandKw: peakDemandKw == null ? null : round(peakDemandKw),
      demandCharge: round(demandCharge), fixedCharge: round(fixedCharge),
      subtotal: round(subtotal), taxRatePercent: tariff.taxRatePercent,
      tax: round(tax), total: round(total),
      averageRatePerKwh: energyKwh > 0 ? round(energyCharge / energyKwh, 4) : null,
      averagePowerFactor: powerFactorSamples ? round(powerFactorTotal / powerFactorSamples, 4) : null,
      readingCount, estimatedReadings,
    },
    charges: [
      { code: 'ENERGY', label: 'Time-of-use energy charges', amount: round(energyCharge) },
      { code: 'DEMAND', label: 'Measured peak demand charge', amount: round(demandCharge) },
      { code: 'FIXED', label: 'Fixed service charge', amount: round(fixedCharge) },
      { code: 'TAX', label: 'Tax / surcharge', amount: round(tax) },
    ],
    daily,
    insights: [
      ...(peakDemandKw == null && tariff.demandChargePerKw > 0 ? ['Demand charges are configured, but demand-kW telemetry is missing; no demand charge was estimated.'] : []),
      ...(estimatedReadings ? [estimatedReadings + ' estimated-quality readings are included in the estimate.'] : []),
      ...(potentialShiftSavings > 0 ? ['Illustrative load-shifting opportunity: shifting 10% of energy used in higher-priced periods to the lowest configured rate could save about ' + round(potentialShiftSavings) + ' ' + tariff.currency + ' before battery losses and operational constraints.'] : []),
    ],
    coverage: { readingCount, estimatedReadings, observedHours: rows.length, observedDays: new Set(rows.map((row) => row._id.date)).size },
  }
}

export async function createTariffPlan({ organizationId, userId, input }) {
  const facility = await Facility.findOne({ _id: input.facilityId, organization: organizationId, status: 'active' }).lean()
  if (!facility) throw new AppError('Active facility not found in this organization.', 404, 'FACILITY_NOT_FOUND')
  const effectiveFrom = new Date(input.effectiveFrom + 'T00:00:00.000Z')
  const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo + 'T23:59:59.999Z') : null
  const overlap = await TariffPlan.exists({
    organization: organizationId, facility: facility._id, status: 'active',
    effectiveFrom: { $lte: effectiveTo ?? new Date('9999-12-31T23:59:59.999Z') },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: effectiveFrom } }],
  })
  if (overlap) throw new AppError('Tariff effective dates overlap an existing active plan. Create a non-overlapping version.', 409, 'TARIFF_PERIOD_OVERLAP')
  const tariff = await TariffPlan.create({
    organization: organizationId, facility: facility._id, name: input.name,
    currency: input.currency, defaultRatePerKwh: input.defaultRatePerKwh,
    energyRates: input.energyRates, demandChargePerKw: input.demandChargePerKw,
    fixedCharge: input.fixedCharge, taxRatePercent: input.taxRatePercent,
    effectiveFrom, effectiveTo, createdBy: userId,
  })
  return { ...tariff.toObject(), facility: { _id: facility._id, name: facility.name, code: facility.code, timezone: facility.timezone } }
}

export async function listTariffPlans({ organizationId, facilityId }) {
  const filter = { organization: organizationId }
  if (facilityId) filter.facility = facilityId
  return TariffPlan.find(filter).populate('facility', 'name code timezone').sort({ effectiveFrom: -1 }).lean()
}

export async function estimateAndSaveBill({ organizationId, userId, input }) {
  const [facility, tariff] = await Promise.all([
    Facility.findOne({ _id: input.facilityId, organization: organizationId, status: 'active' }).lean(),
    TariffPlan.findOne({ _id: input.tariffId, organization: organizationId, facility: input.facilityId, status: 'active' }).lean(),
  ])
  if (!facility) throw new AppError('Active facility not found in this organization.', 404, 'FACILITY_NOT_FOUND')
  if (!tariff) throw new AppError('Tariff plan not found for this facility.', 404, 'TARIFF_NOT_FOUND')
  const periodStart = new Date(input.from + 'T00:00:00.000Z')
  const periodEnd = new Date(input.to + 'T23:59:59.999Z')
  if (tariff.effectiveFrom > periodStart || (tariff.effectiveTo && tariff.effectiveTo < periodEnd)) {
    throw new AppError('The selected tariff is not effective for the entire billing period.', 422, 'TARIFF_OUTSIDE_BILLING_PERIOD')
  }
  const timezone = facility.timezone || 'UTC'
  const current = await hourlyReadings({ organizationId, facilityId: facility._id, from: input.from, to: input.to, timezone })
  const calculated = calculateCosts(current.rows, tariff)
  const periodDays = daysBetween(input.from, input.to)
  const previousTo = dayBefore(input.from, 1)
  const previousFrom = dayBefore(input.from, periodDays)
  const previous = await hourlyReadings({ organizationId, facilityId: facility._id, from: previousFrom, to: previousTo, timezone })
  const previousCost = calculateCosts(previous.rows, tariff)
  const comparison = previousCost.summary.readingCount ? {
    previousPeriod: { from: previousFrom, to: previousTo },
    energyChangeKwh: round(calculated.summary.totalEnergyKwh - previousCost.summary.totalEnergyKwh),
    energyChangePercent: previousCost.summary.totalEnergyKwh > 0 ? round((calculated.summary.totalEnergyKwh - previousCost.summary.totalEnergyKwh) / previousCost.summary.totalEnergyKwh * 100, 2) : null,
    estimatedCostChange: round(calculated.summary.total - previousCost.summary.total),
    estimatedCostChangePercent: previousCost.summary.total > 0 ? round((calculated.summary.total - previousCost.summary.total) / previousCost.summary.total * 100, 2) : null,
    previousEstimatedCost: previousCost.summary.total,
    methodology: 'Both periods are recalculated using the selected tariff version. This is a like-for-like comparison, not a copy of a historical utility invoice.',
  } : null
  const tariffSnapshot = {
    id: String(tariff._id), name: tariff.name, currency: tariff.currency,
    defaultRatePerKwh: tariff.defaultRatePerKwh, energyRates: tariff.energyRates,
    demandChargePerKw: tariff.demandChargePerKw, fixedCharge: tariff.fixedCharge,
    taxRatePercent: tariff.taxRatePercent, timezone,
  }
  const snapshot = {
    organization: organizationId, facility: facility._id, tariff: tariff._id,
    periodStart, periodEnd, currency: tariff.currency, status: 'estimate',
    tariffSnapshot, summary: calculated.summary, charges: calculated.charges,
    daily: calculated.daily, comparison, insights: calculated.insights,
    coverage: { ...calculated.coverage, meterSource: current.source, timezone, dataQuality: 'valid and estimated readings included; flagged readings excluded', periodDays },
    generatedAt: new Date(), generatedBy: userId,
  }
  try {
    return await EnergyBill.findOneAndUpdate(
      { organization: organizationId, facility: facility._id, tariff: tariff._id, periodStart, periodEnd },
      { $set: snapshot, $setOnInsert: { calculationVersion: '1.0.0' } },
      { upsert: true, new: true, runValidators: true },
    ).populate('facility', 'name code').populate('tariff', 'name currency').lean()
  } catch (error) {
    if (error.code === 11000) throw new AppError('A bill estimate for this exact period is being generated. Refresh the bill list.', 409, 'BILL_ESTIMATE_CONFLICT')
    throw error
  }
}

export async function listEnergyBills({ organizationId, facilityId, limit }) {
  const filter = { organization: organizationId }
  if (facilityId) filter.facility = facilityId
  return EnergyBill.find(filter).populate('facility', 'name code').populate('tariff', 'name').sort({ periodStart: -1, generatedAt: -1 }).limit(limit).lean()
}

export async function getEnergyBill({ organizationId, billId }) {
  return EnergyBill.findOne({ _id: billId, organization: organizationId })
    .populate('facility', 'name code timezone').populate('tariff', 'name currency').lean()
}
