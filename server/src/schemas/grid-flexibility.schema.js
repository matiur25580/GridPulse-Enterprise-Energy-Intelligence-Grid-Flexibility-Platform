import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i)

export const gridFlexibilityParamsSchema = z.object({ organizationId: objectId })
export const gridFlexibilityScenarioSchema = z.object({
  historyDays: z.number().int().min(7).max(90).default(30),
  eventHours: z.array(z.number().int().min(0).max(23)).min(1).max(8),
  reductionPercent: z.number().finite().min(1).max(50),
  incentivePerKwh: z.number().finite().nonnegative().max(100000),
  gridEmissionFactorKgPerKwh: z.number().finite().min(0).max(5).default(0.4),
}).superRefine((value, context) => {
  if (new Set(value.eventHours).size !== value.eventHours.length) {
    context.addIssue({ code: 'custom', path: ['eventHours'], message: 'Event hours must not contain duplicates.' })
  }
})
