import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\\d]{24}$/i, 'A valid identifier is required.')
const optionalAddress = z.object({
  line1: z.string().trim().max(160).optional(),
  city: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(24).optional(),
  country: z.string().trim().max(80).optional(),
}).optional()

export const facilityParamsSchema = z.object({ organizationId: objectId, facilityId: objectId })
export const organizationParamsSchema = z.object({ organizationId: objectId })
export const meterParamsSchema = z.object({ organizationId: objectId, meterId: objectId })

export const createFacilitySchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_-]+$/),
  facilityType: z.enum(['office', 'industrial', 'warehouse', 'retail', 'campus', 'other']).default('other'),
  timezone: z.string().trim().min(1).max(64).default('UTC'),
  address: optionalAddress,
})

export const createMeterSchema = z.object({
  facilityId: objectId,
  name: z.string().trim().min(2).max(120),
  serialNumber: z.string().trim().min(2).max(80),
  meterType: z.enum(['main', 'submeter', 'solar', 'battery', 'ev_charger', 'generator']).default('main'),
  ratedPowerKw: z.number().positive().max(1000000).optional(),
  installedAt: z.coerce.date().optional(),
})

const readingSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  recordedAt: z.coerce.date(),
  energyKwh: z.number().finite().nonnegative().max(100000000),
  demandKw: z.number().finite().nonnegative().max(1000000).optional(),
  voltageV: z.number().finite().positive().max(100000).optional(),
  currentA: z.number().finite().nonnegative().max(1000000).optional(),
  powerFactor: z.number().finite().min(0).max(1).optional(),
  source: z.enum(['manual', 'gateway', 'import', 'simulation']).default('manual'),
  quality: z.enum(['valid', 'estimated', 'flagged']).default('valid'),
  metadata: z.record(z.string().max(500)).optional(),
})
export const ingestReadingsSchema = z.object({
  readings: z.array(readingSchema).min(1).max(1000),
}).superRefine(({ readings }, context) => {
  const ids = new Set()
  readings.forEach((reading, index) => {
    if (ids.has(reading.externalId)) {
      context.addIssue({ code: 'custom', path: ['readings', index, 'externalId'], message: 'externalId must be unique within a batch.' })
    }
    ids.add(reading.externalId)
  })
})

export const listReadingsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: 'from must be earlier than or equal to to.',
  path: ['from'],
})
