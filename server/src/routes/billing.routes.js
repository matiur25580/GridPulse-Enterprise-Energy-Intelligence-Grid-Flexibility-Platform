import { Router } from 'express'
import { createTariff, getTariffs, estimateBill, getBills, getBill } from '../controllers/billing.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import {
  organizationBillingParamsSchema, tariffParamsSchema, billParamsSchema,
  createTariffSchema, estimateBillSchema, listBillsQuerySchema,
} from '../schemas/billing.schema.js'

const router = Router()
router.use(authenticate)

router.get('/:organizationId/billing/tariffs',
  validate(organizationBillingParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  getTariffs,
)
router.post('/:organizationId/billing/tariffs',
  validate(organizationBillingParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator'),
  validate(createTariffSchema), createTariff,
)
router.post('/:organizationId/billing/bills/estimate',
  validate(organizationBillingParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst'),
  validate(estimateBillSchema), estimateBill,
)
router.get('/:organizationId/billing/bills',
  validate(organizationBillingParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  validate(listBillsQuerySchema, 'query'), getBills,
)
router.get('/:organizationId/billing/bills/:billId',
  validate(billParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator', 'analyst', 'viewer'),
  getBill,
)

export default router
