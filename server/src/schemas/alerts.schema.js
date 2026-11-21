import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid identifier is required.')
export const alertOrganizationParamsSchema = z.object({ organizationId: objectId })
export const alertRuleParamsSchema = z.object({ organizationId: objectId, ruleId: objectId })
export const incidentParamsSchema = z.object({ organizationId: objectId, incidentId: objectId })

export const createAlertRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(['high_consumption', 'meter_silent', 'gateway_silent']),
  targetId: objectId,
  targetType: z.enum(['facility', 'meter', 'gateway']),
  thresholdKwh: z.number().finite().positive().max(100000000).optional(),
  windowMinutes: z.number().int().min(5).max(10080).default(60),
  staleAfterMinutes: z.number().int().min(5).max(10080).default(60),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
}).superRefine((value, context) => {
  if (value.type === 'high_consumption' && value.thresholdKwh == null) context.addIssue({ code: 'custom', path: ['thresholdKwh'], message: 'A positive kWh threshold is required.' })
  if (value.type !== 'high_consumption' && value.thresholdKwh != null) context.addIssue({ code: 'custom', path: ['thresholdKwh'], message: 'Consumption thresholds only apply to high-consumption rules.' })
})

export const updateAlertRuleSchema = z.object({ status: z.enum(['active', 'disabled']) })
export const evaluateAlertsSchema = z.object({ now: z.string().datetime({ offset: true }).optional() })
export const listIncidentsQuerySchema = z.object({
  status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
export const updateIncidentSchema = z.object({ status: z.enum(['acknowledged', 'resolved']) })
