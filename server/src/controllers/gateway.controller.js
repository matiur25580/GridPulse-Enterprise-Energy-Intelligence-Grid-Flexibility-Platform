import { asyncHandler } from '../utils/async-handler.js'
import { createGatewaySource, ingestGatewayEvents, listGatewaySources, rotateGatewaySecret, setGatewaySourceStatus } from '../services/gateway.service.js'

const organizationId = (request) => request.organization._id

export const createGateway = asyncHandler(async (request, response) => {
  const data = await createGatewaySource({ organizationId: organizationId(request), userId: request.user.id, input: request.body })
  response.status(201).json({ data })
})
export const listGateways = asyncHandler(async (request, response) => {
  const data = await listGatewaySources({ organizationId: organizationId(request) })
  response.json({ data })
})
export const rotateGateway = asyncHandler(async (request, response) => {
  const data = await rotateGatewaySecret({ organizationId: organizationId(request), sourceId: request.params.sourceId })
  response.json({ data })
})
export const updateGatewayStatus = asyncHandler(async (request, response) => {
  const data = await setGatewaySourceStatus({ organizationId: organizationId(request), sourceId: request.params.sourceId, status: request.body.status })
  response.json({ data })
})
export const receiveGatewayEvents = asyncHandler(async (request, response) => {
  const data = await ingestGatewayEvents({ source: request.gatewaySource, events: request.body.events })
  response.status(202).json({ data })
})
