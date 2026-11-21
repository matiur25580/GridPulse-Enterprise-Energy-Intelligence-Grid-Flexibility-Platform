import { buildEnergyReport } from '../services/energy-report.service.js'
import { asyncHandler } from '../utils/async-handler.js'

export const getEnergyReport = asyncHandler(async (request, response) => {
  const query = request.validatedQuery
  const report = await buildEnergyReport({
    organizationId: request.organization._id,
    from: query.from,
    to: query.to,
    gridEmissionFactorKgPerKwh: query.gridEmissionFactorKgPerKwh,
  })
  response.json({
    data: {
      organization: { id: String(request.organization._id), name: request.organization.name },
      ...report,
    },
  })
})
