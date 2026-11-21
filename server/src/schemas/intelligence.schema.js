import { z } from 'zod'

export const intelligenceQuerySchema = z.object({
  historyDays: z.coerce.number().int().min(7).max(90).default(30),
  horizonDays: z.coerce.number().int().min(1).max(14).default(7),
  backtestDays: z.coerce.number().int().min(7).max(30).default(14),
})
