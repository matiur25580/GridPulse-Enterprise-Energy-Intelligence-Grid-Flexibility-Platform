import { Router } from 'express'
import { getImports, getUtilityInvoices, importCsv, reconcileInvoice } from '../controllers/integration.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import {
  integrationMeterParamsSchema, importMeterCsvSchema, listImportsQuerySchema,
  reconcileInvoiceSchema, listInvoicesQuerySchema,
} from '../schemas/integration.schema.js'

const router = Router()
router.use(authenticate)

router.get('/:organizationId/integrations/meter-imports',
  validate(integrationMeterParamsSchema.pick({ organizationId: true }), 'params'),
  requireOrganization, validate(listImportsQuerySchema, 'query'), getImports,
)
router.post('/:organizationId/meters/:meterId/imports/csv',
  validate(integrationMeterParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator'), validate(importMeterCsvSchema), importCsv,
)
router.get('/:organizationId/integrations/utility-invoices',
  validate(integrationMeterParamsSchema.pick({ organizationId: true }), 'params'),
  requireOrganization, validate(listInvoicesQuerySchema, 'query'), getUtilityInvoices,
)
router.post('/:organizationId/integrations/utility-invoices/reconcile',
  validate(integrationMeterParamsSchema.pick({ organizationId: true }), 'params'),
  requireOrganization, authorize('owner', 'admin', 'operator', 'analyst'),
  validate(reconcileInvoiceSchema), reconcileInvoice,
)

export default router
