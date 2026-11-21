import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.')
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(value + 'T00:00:00.000Z')
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}, 'Enter a real calendar date.')

export const integrationMeterParamsSchema = z.object({ organizationId: objectId, meterId: objectId })
export const importMeterCsvSchema = z.object({
  externalBatchId: z.string().trim().min(1).max(120),
  fileName: z.string().trim().min(1).max(180),
  csv: z.string().min(1).max(900_000),
})
export const listImportsQuerySchema = z.object({
  meterId: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
export const listInvoicesQuerySchema = z.object({ facilityId: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(25) })
export const reconcileInvoiceSchema = z.object({
  facilityId: objectId,
  tariffId: objectId,
  invoiceNumber: z.string().trim().min(1).max(120),
  supplier: z.string().trim().min(2).max(160),
  from: dateOnly,
  to: dateOnly,
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']),
  actualEnergyKwh: z.number().finite().min(0).max(1_000_000_000),
  actualAmount: z.number().finite().min(0).max(1_000_000_000_000),
  actualDemandKw: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  tolerancePercent: z.number().finite().min(0).max(25).default(2),
}).refine((value) => value.from <= value.to, { message: 'Invoice start must not follow invoice end.', path: ['from'] })
