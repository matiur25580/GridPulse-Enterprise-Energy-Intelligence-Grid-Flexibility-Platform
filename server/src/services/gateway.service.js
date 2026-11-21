import { randomBytes } from 'node:crypto'
import { GatewaySource } from '../models/gateway-source.model.js'
import { Meter } from '../models/meter.model.js'
import { EnergyReading } from '../models/energy-reading.model.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/app-error.js'
import { encryptGatewaySecret } from '../utils/gateway-security.js'

const publicSource = (source, now = new Date()) => {
  const value = source.toObject ? source.toObject() : source
  delete value.secretCiphertext; delete value.secretIv; delete value.secretTag
  value.meterMappings = (value.meterMappings ?? []).map((mapping) => ({ ...mapping, meter: mapping.meter?.name ? mapping.meter : mapping.meter?.toString() }))
  const threshold = value.expectedIntervalMinutes * 3 * 60 * 1000
  const age = value.lastSuccessAt ? now.getTime() - new Date(value.lastSuccessAt).getTime() : null
  return {
    ...value,
    health: value.status === 'disabled' ? 'disabled' : age == null ? 'awaiting_data' : age > threshold ? 'stale' : 'healthy',
    minutesSinceLastSuccess: age == null ? null : Math.max(0, Math.floor(age / 60000)),
  }
}

function encryptedSecret(secret) {
  try { return encryptGatewaySecret(secret, env.INTEGRATION_ENCRYPTION_KEY) }
  catch { throw new AppError('Gateway credential encryption is not configured. Set INTEGRATION_ENCRYPTION_KEY to a random value of at least 32 characters.', 503, 'GATEWAY_ENCRYPTION_UNAVAILABLE') }
}

export async function createGatewaySource({ organizationId, userId, input }) {
  const meterIds = input.meterMappings.map((item) => item.meterId)
  const meters = await Meter.find({ _id: { $in: meterIds }, organization: organizationId, status: 'active' }).select('_id')
  if (meters.length !== new Set(meterIds).size) throw new AppError('Every mapped meter must be active and belong to this organization.', 422, 'GATEWAY_METER_MAPPING_INVALID')
  const secret = randomBytes(32).toString('hex')
  try {
    const source = await GatewaySource.create({
      organization: organizationId, createdBy: userId, name: input.name,
      expectedIntervalMinutes: input.expectedIntervalMinutes,
      meterMappings: input.meterMappings.map(({ externalMeterId, meterId }) => ({ externalMeterId, meter: meterId })),
      ...encryptedSecret(secret),
    })
    return { source: publicSource(source), signingSecret: secret }
  } catch (error) {
    if (error.code === 11000) throw new AppError('A gateway source with this name already exists in the organization.', 409, 'GATEWAY_SOURCE_NAME_EXISTS')
    throw error
  }
}

export async function listGatewaySources({ organizationId }) {
  const sources = await GatewaySource.find({ organization: organizationId }).populate('meterMappings.meter', 'name serialNumber status').sort({ createdAt: -1 }).lean()
  return sources.map((source) => publicSource(source))
}

export async function rotateGatewaySecret({ organizationId, sourceId }) {
  const secret = randomBytes(32).toString('hex')
  const encrypted = encryptedSecret(secret)
  const source = await GatewaySource.findOneAndUpdate(
    { _id: sourceId, organization: organizationId },
    { $set: encrypted },
    { new: true },
  )
  if (!source) throw new AppError('Gateway source not found in this organization.', 404, 'GATEWAY_SOURCE_NOT_FOUND')
  return { source: publicSource(source), signingSecret: secret }
}

export async function setGatewaySourceStatus({ organizationId, sourceId, status }) {
  const source = await GatewaySource.findOneAndUpdate({ _id: sourceId, organization: organizationId }, { $set: { status } }, { new: true })
  if (!source) throw new AppError('Gateway source not found in this organization.', 404, 'GATEWAY_SOURCE_NOT_FOUND')
  return publicSource(source)
}

export async function ingestGatewayEvents({ source, events }) {
  const mapping = new Map(source.meterMappings.map((item) => [item.externalMeterId, item.meter.toString()]))
  const unknown = [...new Set(events.map((event) => event.externalMeterId).filter((id) => !mapping.has(id)))]
  if (unknown.length) throw new AppError('Payload contains an unmapped external meter ID.', 422, 'GATEWAY_METER_UNMAPPED', { externalMeterIds: unknown.slice(0, 20) })
  const operations = events.map((event) => {
    const meterId = mapping.get(event.externalMeterId)
    return { updateOne: {
      filter: { organization: source.organization, meter: meterId, externalId: event.eventId },
      update: { $setOnInsert: {
        organization: source.organization, facility: source.meterMappings.find((item) => item.externalMeterId === event.externalMeterId).facility ?? undefined,
        meter: meterId, externalId: event.eventId, recordedAt: new Date(event.recordedAt),
        energyKwh: event.energyKwh, demandKw: event.demandKw, voltageV: event.voltageV,
        currentA: event.currentA, powerFactor: event.powerFactor, quality: event.quality,
        source: 'gateway', metadata: { gatewaySourceId: source._id.toString(), externalMeterId: event.externalMeterId },
      } }, upsert: true,
    } }
  })
  const meters = await Meter.find({ _id: { $in: [...new Set(mapping.values())] }, organization: source.organization }).select('_id facility').lean()
  const facilityByMeter = new Map(meters.map((meter) => [meter._id.toString(), meter.facility]))
  for (const operation of operations) {
    const meterId = operation.updateOne.update.$setOnInsert.meter
    operation.updateOne.update.$setOnInsert.facility = facilityByMeter.get(meterId)
  }
  const result = await EnergyReading.bulkWrite(operations, { ordered: true })
  const inserted = result.upsertedCount ?? 0
  const duplicate = events.length - inserted
  const latestEvent = events.reduce((latest, event) => Math.max(latest, new Date(event.recordedAt).getTime()), 0)
  await GatewaySource.updateOne({ _id: source._id, organization: source.organization }, {
    $set: { lastReceivedAt: new Date(), lastSuccessAt: new Date(), lastEventAt: new Date(latestEvent) },
    $inc: { receivedEvents: events.length, insertedEvents: inserted, duplicateEvents: duplicate },
  })
  return { received: events.length, inserted, duplicates: duplicate, acceptedAt: new Date().toISOString() }
}
