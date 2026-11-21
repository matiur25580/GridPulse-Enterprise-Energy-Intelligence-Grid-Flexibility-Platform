import { asyncHandler } from '../utils/async-handler.js'
import { AlertEvaluationRun } from '../models/alert-evaluation-run.model.js'
import { createAlertRule, evaluateEnergyAlerts, listAlertRules, listEnergyIncidents, listAlertEvaluations, setAlertRuleStatus, updateIncidentStatus } from '../services/alerts.service.js'

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
  const now = new Date()
  const startedAt = new Date()
  const run = await AlertEvaluationRun.create({ organization: organizationId(request), trigger: 'manual', status: 'running', startedAt })
  try {
    const summary = await evaluateEnergyAlerts({ organizationId: organizationId(request), now, userId: request.user.id })
    const finishedAt = new Date()
    await AlertEvaluationRun.updateOne({ _id: run._id }, { $set: { ...summary, status: 'succeeded', finishedAt, durationMs: finishedAt - startedAt } })
    response.json({ data: summary })
  } catch (error) {
    const finishedAt = new Date()
    await AlertEvaluationRun.updateOne({ _id: run._id }, { $set: { status: 'failed', finishedAt, durationMs: finishedAt - startedAt, errorCode: error.name === 'AppError' && typeof error.code === 'string' ? error.code.slice(0, 80) : 'EVALUATION_FAILED', errorMessage: 'Alert evaluation failed. Review protected server logs for details.' } })
    throw error
  }
})
export const getEvaluations = asyncHandler(async (request, response) => {
  response.json({ data: await listAlertEvaluations({ organizationId: organizationId(request), limit: request.query.limit }) })
})
export const updateIncident = asyncHandler(async (request, response) => {
  response.json({ data: await updateIncidentStatus({ organizationId: organizationId(request), incidentId: request.params.incidentId, status: request.body.status, userId: request.user.id }) })
})
