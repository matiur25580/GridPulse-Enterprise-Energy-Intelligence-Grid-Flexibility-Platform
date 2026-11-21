import { Meter } from '../models/meter.model.js'
import { MeterImportBatch } from '../models/meter-import-batch.model.js'
import { UtilityInvoice } from '../models/utility-invoice.model.js'
import { Facility } from '../models/facility.model.js'
import { EnergyReading } from '../models/energy-reading.model.js'
import { estimateAndSaveBill } from './billing.service.js'
import { parseMeterReadingsCsv } from '../utils/meter-csv.js'
import { AppError } from '../utils/app-error.js'

const round = (value, digits = 2) => Number(value.toFixed(digits))

export async function importMeterCsv({ organizationId, userId, meterId, input }) {
  const meter = await Meter.findOne({ _id: meterId, organization: organizationId, status: 'active' }).select('_id facility').lean()
  if (!meter) throw new AppError('Active meter not found in this organization.', 404, 'METER_NOT_FOUND')
  const readings = parseMeterReadingsCsv(input.csv)
  let batch
  try {
    batch = await MeterImportBatch.create({
      organization: organizationId, facility: meter.facility, meter: meter._id,
      externalBatchId: input.externalBatchId, fileName: input.fileName,
      received: readings.length, createdBy: userId,
    })
  } catch (error) {
    if (error.code !== 11000) throw error
    batch = await MeterImportBatch.findOne({ organization: organizationId, meter: meter._id, externalBatchId: input.externalBatchId })
    if (!batch) throw error
    if (batch.status === 'completed') return { batch, replayed: true }
    if (batch.status === 'processing') throw new AppError('This import batch is already processing.', 409, 'IMPORT_BATCH_IN_PROGRESS')
    batch.status = 'processing'; batch.received = readings.length; batch.inserted = 0
    batch.duplicates = 0; batch.errorSummary = undefined; batch.startedAt = new Date(); batch.completedAt = undefined
    await batch.save()
  }

  try {
    const operations = readings.map((reading) => ({
      updateOne: {
        filter: { organization: organizationId, meter: meter._id, externalId: reading.externalId },
        update: { $setOnInsert: { organization: organizationId, facility: meter.facility, meter: meter._id, ...reading } },
        upsert: true,
      },
    }))
    const result = await EnergyReading.bulkWrite(operations, { ordered: true })
    batch.inserted = result.upsertedCount
    batch.duplicates = readings.length - result.upsertedCount
    batch.status = 'completed'
    batch.completedAt = new Date()
    await batch.save()
    return { batch, replayed: false }
  } catch (error) {
    batch.status = 'failed'
    batch.errorSummary = error.message?.slice(0, 500) || 'Import failed.'
    await batch.save()
    if (error.code === 11000) throw new AppError('A reading conflicted with another concurrent ingestion. Retry the same batch ID safely.', 409, 'IMPORT_READING_CONFLICT')
    throw error
  }
}

export async function listMeterImports({ organizationId, meterId, limit }) {
  const filter = { organization: organizationId }
  if (meterId) filter.meter = meterId
  return MeterImportBatch.find(filter).populate('facility', 'name code').populate('meter', 'name serialNumber').sort({ createdAt: -1 }).limit(limit).lean()
}

export async function reconcileUtilityInvoice({ organizationId, userId, input }) {
  const facility = await Facility.findOne({ _id: input.facilityId, organization: organizationId, status: 'active' }).select('_id').lean()
  if (!facility) throw new AppError('Active facility not found in this organization.', 404, 'FACILITY_NOT_FOUND')
  const estimate = await estimateAndSaveBill({
    organizationId, userId,
    input: { facilityId: input.facilityId, tariffId: input.tariffId, from: input.from, to: input.to },
  })
  if (estimate.currency !== input.currency) throw new AppError('Invoice currency must match the selected tariff currency.', 422, 'INVOICE_CURRENCY_MISMATCH')
  const estimatedAmount = estimate.summary.total
  const amountVariance = round(input.actualAmount - estimatedAmount)
  const amountVariancePercent = estimatedAmount > 0 ? round(amountVariance / estimatedAmount * 100, 2) : null
  const energyVarianceKwh = round(input.actualEnergyKwh - estimate.summary.totalEnergyKwh)
  const energyVariancePercent = estimate.summary.totalEnergyKwh > 0 ? round(energyVarianceKwh / estimate.summary.totalEnergyKwh * 100, 2) : null
  const demandVarianceKw = input.actualDemandKw == null || estimate.summary.peakDemandKw == null
    ? null : round(input.actualDemandKw - estimate.summary.peakDemandKw)
  const withinTolerance = amountVariancePercent != null && Math.abs(amountVariancePercent) <= input.tolerancePercent
  const reconciliation = {
    status: withinTolerance ? 'within_tolerance' : 'discrepancy',
    tolerancePercent: input.tolerancePercent,
    estimatedAmount: round(estimatedAmount), actualAmount: round(input.actualAmount),
    amountVariance, amountVariancePercent,
    estimatedEnergyKwh: estimate.summary.totalEnergyKwh,
    actualEnergyKwh: input.actualEnergyKwh, energyVarianceKwh, energyVariancePercent,
    estimatedDemandKw: estimate.summary.peakDemandKw,
    actualDemandKw: input.actualDemandKw ?? null, demandVarianceKw,
    currency: input.currency,
    notes: [
      ...(amountVariance > 0 ? ['Actual utility amount is higher than the modeled estimate.'] : amountVariance < 0 ? ['Actual utility amount is lower than the modeled estimate.'] : ['Actual and modeled amounts match.']),
      ...(estimate.summary.peakDemandKw == null ? ['Demand comparison is unavailable because the estimate lacks complete measured demand coverage.'] : []),
      ...(amountVariancePercent == null ? ['Percentage variance is unavailable because the modeled amount is zero.'] : []),
    ],
    methodology: 'Actual invoice totals are compared with a newly generated GridPulse estimate using the selected tariff version and eligible meter telemetry for the same facility and dates. This is an exception-screening aid, not an accounting adjustment.',
    reconciledAt: new Date(),
  }
  try {
    return await UtilityInvoice.create({
      organization: organizationId, facility: input.facilityId, billEstimate: estimate._id,
      invoiceNumber: input.invoiceNumber, supplier: input.supplier,
      periodStart: new Date(input.from + 'T00:00:00.000Z'),
      periodEnd: new Date(input.to + 'T23:59:59.999Z'),
      currency: input.currency, actualEnergyKwh: input.actualEnergyKwh,
      actualAmount: input.actualAmount, actualDemandKw: input.actualDemandKw ?? null,
      reconciliation, importedBy: userId,
    })
  } catch (error) {
    if (error.code === 11000) throw new AppError('This utility invoice number is already recorded for the facility.', 409, 'INVOICE_ALREADY_EXISTS')
    throw error
  }
}

export async function listUtilityInvoices({ organizationId, facilityId, limit }) {
  const filter = { organization: organizationId }
  if (facilityId) filter.facility = facilityId
  return UtilityInvoice.find(filter).populate('facility', 'name code').populate('billEstimate', 'periodStart periodEnd summary currency').sort({ periodStart: -1 }).limit(limit).lean()
}
