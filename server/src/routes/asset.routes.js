import { Router } from 'express'
import {
  createFacility, listFacilities, getFacility,
  createMeter, listMeters, ingestReadings, listReadings,
} from '../controllers/asset.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import {
  createFacilitySchema, createMeterSchema, ingestReadingsSchema,
  facilityParamsSchema, organizationParamsSchema, meterParamsSchema, listReadingsQuerySchema,
} from '../schemas/asset.schema.js'

const router = Router()
router.use(authenticate)

router.get('/:organizationId/facilities', validate(organizationParamsSchema, 'params'), requireOrganization, listFacilities)
router.post('/:organizationId/facilities', validate(organizationParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(createFacilitySchema), createFacility)
router.get('/:organizationId/facilities/:facilityId', validate(facilityParamsSchema, 'params'), requireOrganization, getFacility)

router.get('/:organizationId/meters', validate(organizationParamsSchema, 'params'), requireOrganization, listMeters)
router.post('/:organizationId/meters', validate(organizationParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(createMeterSchema), createMeter)
router.post('/:organizationId/meters/:meterId/readings', validate(meterParamsSchema, 'params'), requireOrganization, authorize('owner', 'admin', 'operator'), validate(ingestReadingsSchema), ingestReadings)
router.get('/:organizationId/meters/:meterId/readings', validate(meterParamsSchema, 'params'), requireOrganization, listReadings)

export default router
