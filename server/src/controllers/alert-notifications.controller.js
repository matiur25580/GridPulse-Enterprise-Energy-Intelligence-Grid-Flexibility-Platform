import { asyncHandler } from '../utils/async-handler.js'
import { getNotificationSubscription, saveNotificationSubscription } from '../services/alert-notifications.service.js'

export const getSubscription = asyncHandler(async (request, response) => {
  const data = await getNotificationSubscription({ organizationId: request.organization._id })
  response.json({ data: data ?? { enabled: false, emails: [] } })
})

export const updateSubscription = asyncHandler(async (request, response) => {
  const data = await saveNotificationSubscription({
    organizationId: request.organization._id,
    userId: request.user.id,
    input: request.body,
  })
  response.json({ data })
})
