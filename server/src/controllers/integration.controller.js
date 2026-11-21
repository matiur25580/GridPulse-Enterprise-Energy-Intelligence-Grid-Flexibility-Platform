import { asyncHandler } from '../utils/async-handler.js'
import { importMeterCsv, listMeterImports, listUtilityInvoices, reconcileUtilityInvoice } from '../services/integration.service.js'

const organizationId = (request) => request.organization._id

export const importCsv = asyncHandler(async (request, response) => {
  const result = await importMeterCsv({
    organizationId: organizationId(request), userId: request.user.id,
    meterId: request.params.meterId, input: request.body,
  })
  response.status(result.replayed ? 200 : 202).json({ data: result })
})

export const getImports = asyncHandler(async (request, response) => {
  const data = await listMeterImports({
    organizationId: organizationId(request),
    meterId: request.validatedQuery.meterId,
    limit: request.validatedQuery.limit,
  })
  response.json({ data })
})

export const reconcileInvoice = asyncHandler(async (request, response) => {
  const data = await reconcileUtilityInvoice({
    organizationId: organizationId(request), userId: request.user.id, input: request.body,
  })
  response.status(201).json({ data })
})

export const getUtilityInvoices = asyncHandler(async (request, response) => {
  const data = await listUtilityInvoices({
    organizationId: organizationId(request),
    facilityId: request.validatedQuery.facilityId,
    limit: request.validatedQuery.limit,
  })
  response.json({ data })
})
