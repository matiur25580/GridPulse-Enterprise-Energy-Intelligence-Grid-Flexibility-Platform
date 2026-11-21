import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.')
const mappingSchema = z.object({
  externalMeterId: z.string().trim().min(1).max(120),
  meterId: objectId,
})
export const gatewayOrganizationParamsSchema = z.object({ organizationId: objectId })
export const gatewaySourceParamsSchema = z.object({ organizationId: objectId, sourceId: objectId })
export const createGatewaySourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  expectedIntervalMinutes: z.number().int().min(1).max(1440).default(15),
  meterMappings: z.array(mappingSchema).min(1).max(100),
}).superRefine(({ meterMappings }, context) => {
  const externalIds = new Set()
  const meterIds = new Set()
  meterMappings.forEach((mapping, index) => {
    if (externalIds.has(mapping.externalMeterId)) context.addIssue({ code: 'custom', path: ['meterMappings', index, 'externalMeterId'], message: 'External meter IDs must be unique.' })
    if (meterIds.has(mapping.meterId)) context.addIssue({ code: 'custom', path: ['meterMappings', index, 'meterId'], message: 'A local meter can only be mapped once per source.' })
    externalIds.add(mapping.externalMeterId)
    meterIds.add(mapping.meterId)
  })
})
export const gatewayEventsSchema = z.object({
  events: z.array(z.object({
    eventId: z.string().trim().min(1).max(120),
    externalMeterId: z.string().trim().min(1).max(120),
    recordedAt: z.string().datetime({ offset: true }),
    energyKwh: z.number().finite().min(0).max(100000000),
    demandKw: z.number().finite().min(0).max(1000000).optional(),
    voltageV: z.number().finite().positive().max(100000).optional(),
    currentA: z.number().finite().min(0).max(1000000).optional(),
    powerFactor: z.number().finite().min(0).max(1).optional(),
    quality: z.enum(['valid', 'estimated', 'flagged']).default('valid'),
  })).min(1).max(500),
}).superRefine(({ events }, context) => {
  const keys = new Set()
  events.forEach((event, index) => {
    const key = event.externalMeterId + ':' + event.eventId
    if (keys.has(key)) context.addIssue({ code: 'custom', path: ['events', index, 'eventId'], message: 'Duplicate event ID for this external meter in one request.' })
    keys.add(key)
  })
})
