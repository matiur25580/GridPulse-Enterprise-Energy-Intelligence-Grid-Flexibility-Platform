import { Router } from 'express'
import { runGridFlexibilityScenario } from '../controllers/grid-flexibility.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { gridFlexibilityParamsSchema, gridFlexibilityScenarioSchema } from '../schemas/grid-flexibility.schema.js'

const router = Router()
router.use(authenticate)
router.post('/:organizationId/grid-flexibility/simulate',
  validate(gridFlexibilityParamsSchema, 'params'),
  requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  validate(gridFlexibilityScenarioSchema),
  runGridFlexibilityScenario,
)
export default router
