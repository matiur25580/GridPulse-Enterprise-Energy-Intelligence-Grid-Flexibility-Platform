import { asyncHandler } from '../utils/async-handler.js'
import { createAlertRule, evaluateEnergyAlerts, listAlertRules, listEnergyIncidents, setAlertRuleStatus, updateIncidentStatus } from '../services/alerts.service.js'

const organizationId = (request) => request.organization._id

export const createRule = asyncHandler(async (request, response) => {
  const data = await createAlertRule({ organizationId: organizationId(request), userId: request.user.id, input: request.body })
  response.status(201).json({ data })
})
export const getRules = asyncHandler(async (request, response) => {
  response.json({ data: await listAlertRules({ organizationId: organizationId(request) }) })
})
export const updateRule = asyncHandler(async (request, response) => {
  response.json({ data: await setAlertRuleStatus({ organizationId: organizationId(request), ruleId: request.params.ruleId, status: request.body.status }) })
})
export const getIncidents = asyncHandler(async (request, response) => {
  response.json({ data: await listEnergyIncidents({ organizationId: organizationId(request), filters: request.query }) })
})
export const evaluateAlerts = asyncHandler(async (request, response) => {
  const now = request.body.now ? new Date(request.body.now) : new Date()
  response.json({ data: await evaluateEnergyAlerts({ organizationId: organizationId(request), now, userId: request.user.id }) })
})
export const updateIncident = asyncHandler(async (request, response) => {
  response.json({ data: await updateIncidentStatus({ organizationId: organizationId(request), incidentId: request.params.incidentId, status: request.body.status, userId: request.user.id }) })
})
