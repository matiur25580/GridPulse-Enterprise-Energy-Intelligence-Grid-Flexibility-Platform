import { Router } from 'express'
import { createGateway, listGateways, receiveGatewayEvents, rotateGateway, updateGatewayStatus } from '../controllers/gateway.controller.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize, requireOrganization } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { verifyGatewaySignature } from '../middleware/verify-gateway-signature.js'
import { createGatewaySourceSchema, gatewayEventsSchema, gatewayOrganizationParamsSchema, gatewaySourceParamsSchema } from '../schemas/gateway.schema.js'
import { z } from 'zod'

const router = Router()
router.post('/integrations/gateways/:sourceId/readings',
  verifyGatewaySignature, validate(gatewayEventsSchema), receiveGatewayEvents,
)
router.get('/organizations/:organizationId/integrations/gateways',
  authenticate, validate(gatewayOrganizationParamsSchema, 'params'), requireOrganization, listGateways,
)
router.post('/organizations/:organizationId/integrations/gateways',
  authenticate, validate(gatewayOrganizationParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator'), validate(createGatewaySourceSchema), createGateway,
)
router.post('/organizations/:organizationId/integrations/gateways/:sourceId/rotate-secret',
  authenticate, validate(gatewaySourceParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator'), rotateGateway,
)
router.patch('/organizations/:organizationId/integrations/gateways/:sourceId/status',
  authenticate, validate(gatewaySourceParamsSchema, 'params'), requireOrganization,
  authorize('owner', 'admin', 'operator'), validate(z.object({ status: z.enum(['active', 'disabled']) })), updateGatewayStatus,
)
export default router
