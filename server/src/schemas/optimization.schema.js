import { z } from 'zod'

export const optimizationParamsSchema = z.object({
  organizationId: z.string().regex(/^[a-f\d]{24}$/i),
})

export const optimizationScenarioSchema = z.object({
  historyDays: z.coerce.number().int().min(7).max(90).default(30),
  offPeakRatePerKwh: z.number().finite().nonnegative().max(100000),
  peakRatePerKwh: z.number().finite().positive().max(100000),
  peakHours: z.array(z.number().int().min(0).max(23)).min(1).max(12),
  batteryCapacityKwh: z.number().finite().nonnegative().max(1000000).default(0),
  batteryPowerKw: z.number().finite().nonnegative().max(1000000).default(0),
  initialSocPercent: z.number().min(0).max(100).default(50),
  reserveSocPercent: z.number().min(0).max(100).default(20),
  roundTripEfficiency: z.number().min(0.5).max(1).default(0.9),
}).superRefine((value, context) => {
  if (value.peakRatePerKwh < value.offPeakRatePerKwh) {
    context.addIssue({ code: 'custom', path: ['peakRatePerKwh'], message: 'Peak rate must be greater than or equal to the off-peak rate.' })
  }
  if (value.batteryCapacityKwh === 0 && value.batteryPowerKw > 0) {
    context.addIssue({ code: 'custom', path: ['batteryPowerKw'], message: 'Battery power requires a positive battery capacity.' })
  }
  if (value.batteryCapacityKwh > 0 && value.batteryPowerKw === 0) {
    context.addIssue({ code: 'custom', path: ['batteryPowerKw'], message: 'Enter battery power to simulate storage.' })
  }
  if (value.reserveSocPercent > value.initialSocPercent) {
    context.addIssue({ code: 'custom', path: ['reserveSocPercent'], message: 'Reserve state of charge cannot exceed the initial state of charge.' })
  }
  if (new Set(value.peakHours).size !== value.peakHours.length) {
    context.addIssue({ code: 'custom', path: ['peakHours'], message: 'Peak hours must not contain duplicates.' })
  }
})
