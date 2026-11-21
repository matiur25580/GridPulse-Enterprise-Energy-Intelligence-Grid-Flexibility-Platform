import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\\d]{24}$/i, 'A valid identifier is required.')
const dateOnly = z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/, 'Use YYYY-MM-DD dates.').refine((value) => { const time = Date.parse(value + 'T00:00:00.000Z'); return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value }, 'Enter a real calendar date.')
const hours = z.array(z.number().int().min(0).max(23)).min(1).max(24).refine((values) => new Set(values).size === values.length, 'Hours must be unique.')
const days = z.array(z.number().int().min(0).max(6)).min(1).max(7).refine((values) => new Set(values).size === values.length, 'Days must be unique.')

export const createTariffSchema = z.object({
  facilityId: objectId,
  name: z.string().trim().min(2).max(120),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY']).default('INR'),
  defaultRatePerKwh: z.number().finite().min(0).max(100000),
  energyRates: z.array(z.object({
    label: z.string().trim().min(2).max(60),
    ratePerKwh: z.number().finite().min(0).max(100000),
    hours,
    daysOfWeek: days.default([0, 1, 2, 3, 4, 5, 6]),
  })).max(12).default([]),
  demandChargePerKw: z.number().finite().min(0).max(1000000).default(0),
  fixedCharge: z.number().finite().min(0).max(100000000).default(0),
  taxRatePercent: z.number().finite().min(0).max(100).default(0),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly.nullable().optional(),
}).superRefine((value, context) => {
  if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
    context.addIssue({ code: 'custom', path: ['effectiveTo'], message: 'Effective end must not precede effective start.' })
  }
  const occupied = new Set()
  value.energyRates.forEach((rate, index) => rate.daysOfWeek.forEach((day) => rate.hours.forEach((hour) => {
    const key = day * 24 + hour
    if (occupied.has(key)) context.addIssue({ code: 'custom', path: ['energyRates', index, 'hours'], message: 'Time-of-use periods cannot overlap on the same weekday.' })
    occupied.add(key)
  })))
})

export const organizationBillingParamsSchema = z.object({ organizationId: objectId })
export const tariffParamsSchema = z.object({ organizationId: objectId, tariffId: objectId })
export const billParamsSchema = z.object({ organizationId: objectId, billId: objectId })
export const estimateBillSchema = z.object({
  facilityId: objectId,
  tariffId: objectId,
  from: dateOnly,
  to: dateOnly,
}).refine((value) => value.from <= value.to, { message: 'Billing start must be earlier than or equal to end.', path: ['from'] })
  .refine((value) => (Date.parse(value.to + 'T00:00:00Z') - Date.parse(value.from + 'T00:00:00Z')) / 86400000 <= 366, {
    message: 'Billing periods cannot exceed 366 days.', path: ['to'],
  })

export const listBillsQuerySchema = z.object({ facilityId: objectId.optional(), limit: z.coerce.number().int().min(1).max(100).default(25) })

export const listTariffsQuerySchema = z.object({ facilityId: objectId.optional() })
