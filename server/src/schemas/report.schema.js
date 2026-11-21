import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i)
export const reportParamsSchema = z.object({ organizationId: objectId })
export const reportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  gridEmissionFactorKgPerKwh: z.coerce.number().finite().min(0).max(5).default(0.4),
}).refine((value) => value.from <= value.to, {
  message: 'Report start must be earlier than or equal to report end.',
  path: ['from'],
}).refine((value) => value.to.getTime() - value.from.getTime() <= 366 * 86400000, {
  message: 'Report periods cannot exceed 366 days.',
  path: ['to'],
})
