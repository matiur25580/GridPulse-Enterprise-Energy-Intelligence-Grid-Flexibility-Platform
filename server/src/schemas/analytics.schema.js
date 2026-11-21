import { z } from 'zod'

export const analyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(({ from, to }) => !from || !to || from <= to, {
  message: 'from must be earlier than or equal to to.',
  path: ['from'],
})
