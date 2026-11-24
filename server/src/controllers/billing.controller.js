import {
  createTariffPlan, listTariffPlans, estimateAndSaveBill, listEnergyBills, getEnergyBill,
} from '../services/billing.service.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'

const organizationId = (request) => request.organization._id

export const createTariff = asyncHandler(async (request, response) => {
  const tariff = await createTariffPlan({ organizationId: organizationId(request), userId: request.user.id, input: request.body })
  response.status(201).json({ data: tariff })
})

export const getTariffs = asyncHandler(async (request, response) => {
  const tariffs = await listTariffPlans({ organizationId: organizationId(request), facilityId: request.query.facilityId })
  response.json({ data: tariffs })
})

// Delegate tariff-based bill estimation while explicitly carrying tenant and actor context into the service.
export const estimateBill = asyncHandler(async (request, response) => {
  const bill = await estimateAndSaveBill({ organizationId: organizationId(request), userId: request.user.id, input: request.body })
  response.status(201).json({ data: bill })
})

export const getBills = asyncHandler(async (request, response) => {
  const bills = await listEnergyBills({ organizationId: organizationId(request), facilityId: request.validatedQuery.facilityId, limit: request.validatedQuery.limit })
  response.json({ data: bills })
})

export const getBill = asyncHandler(async (request, response) => {
  const bill = await getEnergyBill({ organizationId: organizationId(request), billId: request.params.billId })
  if (!bill) throw new AppError('Bill estimate not found.', 404, 'BILL_NOT_FOUND')
  response.json({ data: bill })
})
