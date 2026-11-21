import { createHash } from 'node:crypto'
import { Meter } from '../models/meter.model.js'
import { MeterImportBatch } from '../models/meter-import-batch.model.js'
import { UtilityInvoice } from '../models/utility-invoice.model.js'
import { Facility } from '../models/facility.model.js'
import { EnergyReading } from '../models/energy-reading.model.js'
import { estimateAndSaveBill } from './billing.service.js'
import { parseMeterReadingsCsv } from '../utils/meter-csv.js'
import { AppError } from '../utils/app-error.js'
import { calculateInvoiceReconciliation } from '../utils/invoice-reconciliation.js'

const round = (value, digits = 2) => Number(value.toFixed(digits))

export async function importMeterCsv({ organizationId, userId, meterId, input }) {
  const meter = await Meter.findOne({ _id: meterId, organization: organizationId, status: 'active' }).select('_id facility').lean()
  if (!meter) throw new AppError('Active meter not found in this organization.', 404, 'METER_NOT_FOUND')
  const readings = parseMeterReadingsCsv(input.csv)
  const payloadHash = createHash('sha256').update(input.csv, 'utf8').digest('hex')
  let batch
  try {
    batch = await MeterImportBatch.create({
      organization: organizationId, facility: meter.facility, meter: meter._id,
      externalBatchId: input.externalBatchId, fileName: input.fileName, payloadHash,
      received: readings.length, createdBy: userId,
    })
  } catch (error) {
    if (error.code !== 11000) throw error
    batch = await MeterImportBatch.findOne({ organization: organizationId, meter: meter._id, externalBatchId: input.externalBatchId })
    if (!batch) throw error
    if (batch.payloadHash !== payloadHash) throw new AppError('This batch ID was already used with different CSV content. Use a new batch ID.', 409, 'IMPORT_BATCH_PAYLOAD_MISMATCH')
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
  const reconciliation = calculateInvoiceReconciliation({
    actualAmount: input.actualAmount, estimatedAmount: estimate.summary.total,
    actualEnergyKwh: input.actualEnergyKwh, estimatedEnergyKwh: estimate.summary.totalEnergyKwh,
    actualDemandKw: input.actualDemandKw ?? null, estimatedDemandKw: estimate.summary.peakDemandKw,
    currency: input.currency, tolerancePercent: input.tolerancePercent,
  })
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
