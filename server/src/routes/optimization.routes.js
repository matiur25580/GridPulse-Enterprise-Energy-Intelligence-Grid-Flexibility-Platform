import { Router } from 'express'
import { runOptimizationScenario } from '../controllers/optimization.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { optimizationParamsSchema, optimizationScenarioSchema } from '../schemas/optimization.schema.js'

const router = Router()
router.use(authenticate)
router.post('/:organizationId/optimization/simulate',
  validate(optimizationParamsSchema, 'params'),
  requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  validate(optimizationScenarioSchema),
  runOptimizationScenario,
)
export default router
