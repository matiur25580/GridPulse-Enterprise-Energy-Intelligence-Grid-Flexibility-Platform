import mongoose from 'mongoose'
import { Facility } from '../models/facility.model.js'
import { Meter } from '../models/meter.model.js'
import { EnergyReading } from '../models/energy-reading.model.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'

const orgId = (request) => request.organization.id
const duplicateError = (error, label) => {
  if (error.code === 11000) throw new AppError(`${label} already exists in this organization.`, 409, 'RESOURCE_ALREADY_EXISTS')
  throw error
}

export const createFacility = asyncHandler(async (request, response) => {
  try {
    const facility = await Facility.create({
      ...request.body,
      organization: orgId(request),
      createdBy: request.user.id,
    })
    response.status(201).json({ data: facility })
  } catch (error) { duplicateError(error, 'Facility code') }
})

export const listFacilities = asyncHandler(async (request, response) => {
  const facilities = await Facility.find({ organization: orgId(request) }).sort({ name: 1 }).lean()
  response.json({ data: facilities })
})

export const getFacility = asyncHandler(async (request, response) => {
  const facility = await Facility.findOne({ _id: request.params.facilityId, organization: orgId(request) }).lean()
  if (!facility) throw new AppError('Facility not found.', 404, 'FACILITY_NOT_FOUND')
  response.json({ data: facility })
})

export const createMeter = asyncHandler(async (request, response) => {
  const facility = await Facility.findOne({
    _id: request.body.facilityId,
    organization: orgId(request),
    status: 'active',
  }).select('_id')
  if (!facility) throw new AppError('The selected facility is not available in this organization.', 404, 'FACILITY_NOT_FOUND')
  try {
    const meter = await Meter.create({
      organization: orgId(request),
      facility: facility._id,
      name: request.body.name,
      serialNumber: request.body.serialNumber,
      meterType: request.body.meterType,
      ratedPowerKw: request.body.ratedPowerKw,
      installedAt: request.body.installedAt,
      createdBy: request.user.id,
    })
    response.status(201).json({ data: meter })
  } catch (error) { duplicateError(error, 'Meter serial number') }
})

export const listMeters = asyncHandler(async (request, response) => {
  const filter = { organization: orgId(request) }
  if (request.query.facilityId) {
    if (!mongoose.isValidObjectId(request.query.facilityId)) throw new AppError('facilityId is invalid.', 400, 'INVALID_FACILITY_ID')
    filter.facility = request.query.facilityId
  }
  const meters = await Meter.find(filter).populate('facility', 'name code').sort({ name: 1 }).lean()
  response.json({ data: meters })
})

export const ingestReadings = asyncHandler(async (request, response) => {
  const meter = await Meter.findOne({
    _id: request.params.meterId,
    organization: orgId(request),
    status: 'active',
  }).select('_id facility')
  if (!meter) throw new AppError('Meter not found or inactive.', 404, 'METER_NOT_FOUND')

  const operations = request.body.readings.map((reading) => ({
    updateOne: {
      filter: {
        organization: request.organization._id,
        meter: meter._id,
        externalId: reading.externalId,
      },
      update: {
        $setOnInsert: {
          organization: request.organization._id,
          facility: meter.facility,
          meter: meter._id,
          ...reading,
        },
      },
      upsert: true,
    },
  }))
  try {
    const result = await EnergyReading.bulkWrite(operations, { ordered: true })
    response.status(202).json({
      data: {
        received: request.body.readings.length,
        inserted: result.upsertedCount,
        duplicates: request.body.readings.length - result.upsertedCount,
      },
    })
  } catch (error) {
    if (error.code === 11000) throw new AppError('A reading conflicts with an existing event identifier.', 409, 'READING_CONFLICT')
    throw error
  }
})

export const listReadings = asyncHandler(async (request, response) => {
  const filter = { organization: orgId(request), meter: request.params.meterId }
  const meterExists = await Meter.exists({ _id: request.params.meterId, organization: orgId(request) })
  if (!meterExists) throw new AppError('Meter not found.', 404, 'METER_NOT_FOUND')
  if (request.query.from || request.query.to) {
    filter.recordedAt = {}
    if (request.query.from) filter.recordedAt.$gte = request.query.from
    if (request.query.to) filter.recordedAt.$lte = request.query.to
  }
  const { page, limit } = request.query
  const [readings, total] = await Promise.all([
    EnergyReading.find(filter).sort({ recordedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    EnergyReading.countDocuments(filter),
  ])
  response.json({
    data: readings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  })
})
