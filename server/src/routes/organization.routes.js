import { Router } from 'express'
import { getOrganization, listOrganizations } from '../controllers/organization.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'

const router = Router()
router.use(authenticate)
router.get('/', listOrganizations)
router.get('/:organizationId', requireOrganization, authorize('owner', 'admin', 'operator', 'analyst', 'viewer'), getOrganization)
export default router
