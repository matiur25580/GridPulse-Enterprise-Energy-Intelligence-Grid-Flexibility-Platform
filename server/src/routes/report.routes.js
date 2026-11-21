import { Router } from 'express'
import { getEnergyReport } from '../controllers/report.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { reportParamsSchema, reportQuerySchema } from '../schemas/report.schema.js'

const router = Router()
router.use(authenticate)
router.get('/:organizationId/reports/energy',
  validate(reportParamsSchema, 'params'),
  requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  validate(reportQuerySchema, 'query'),
  getEnergyReport,
)
export default router
