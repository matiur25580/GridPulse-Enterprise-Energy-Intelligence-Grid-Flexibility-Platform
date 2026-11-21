import { Router } from 'express'
import { getEnergyIntelligence } from '../controllers/intelligence.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { intelligenceQuerySchema } from '../schemas/intelligence.schema.js'

const router = Router()
router.use(authenticate)
router.get('/:organizationId/analytics/intelligence',
  requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  validate(intelligenceQuerySchema, 'query'),
  getEnergyIntelligence,
)
export default router
