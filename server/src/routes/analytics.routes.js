import { Router } from 'express'
import { getEnergyOverview } from '../controllers/analytics.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { requireOrganization, authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { analyticsQuerySchema } from '../schemas/analytics.schema.js'

const router = Router()
router.use(authenticate)
router.get('/:organizationId/analytics/overview',
  requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  validate(analyticsQuerySchema, 'query'),
  getEnergyOverview,
)
export default router
