import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { createRule, evaluateAlerts, getIncidents, getRules, updateIncident, updateRule } from '../controllers/alerts.controller.js'
import { alertOrganizationParamsSchema, alertRuleParamsSchema, createAlertRuleSchema, evaluateAlertsSchema, incidentParamsSchema, listIncidentsQuerySchema, updateAlertRuleSchema, updateIncidentSchema } from '../schemas/alerts.schema.js'

const router = Router()
router.use(authenticate)
router.get('/:organizationId/alerts/rules', validate(alertOrganizationParamsSchema, 'params'), requireOrganization, getRules)
router.post('/:organizationId/alerts/rules', validate(alertOrganizationParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(createAlertRuleSchema), createRule)
router.patch('/:organizationId/alerts/rules/:ruleId', validate(alertRuleParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(updateAlertRuleSchema), updateRule)
router.get('/:organizationId/alerts/incidents', validate(alertOrganizationParamsSchema, 'params'), requireOrganization, validate(listIncidentsQuerySchema, 'query'), getIncidents)
router.post('/:organizationId/alerts/evaluate', validate(alertOrganizationParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(evaluateAlertsSchema), evaluateAlerts)
router.patch('/:organizationId/alerts/incidents/:incidentId', validate(incidentParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(updateIncidentSchema), updateIncident)
export default router
