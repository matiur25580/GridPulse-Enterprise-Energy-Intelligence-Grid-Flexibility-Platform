import { Router } from 'express'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { getSubscription, updateSubscription } from '../controllers/alert-notifications.controller.js'
import { alertOrganizationParamsSchema } from '../schemas/alerts.schema.js'
import { notificationSubscriptionSchema } from '../schemas/alert-notifications.schema.js'

const router = Router()
router.use(authenticate)
router.get('/:organizationId/alerts/notifications', validate(alertOrganizationParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin'), getSubscription)
router.put('/:organizationId/alerts/notifications', validate(alertOrganizationParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin'), validate(notificationSubscriptionSchema), updateSubscription)
export default router
