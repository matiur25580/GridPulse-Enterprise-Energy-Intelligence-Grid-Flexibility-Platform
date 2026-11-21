import { AlertNotificationSubscription } from '../models/alert-notification-subscription.model.js'
import { AlertNotificationOutbox } from '../models/alert-notification-outbox.model.js'

export async function getNotificationSubscription({ organizationId }) {
  return AlertNotificationSubscription.findOne({ organization: organizationId }).lean()
}

export async function saveNotificationSubscription({ organizationId, userId, input }) {
  return AlertNotificationSubscription.findOneAndUpdate(
    { organization: organizationId },
    { $set: { ...input, updatedBy: userId } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean()
}

export async function enqueueIncidentNotification({ incident, event }) {
  const subscription = await AlertNotificationSubscription.findOne({
    organization: incident.organization, enabled: true, emails: { $exists: true, $ne: [] },
  }).lean()
  if (!subscription?.emails?.length) return null
  const idempotencyKey = `${incident._id}:${event}`
  try {
    return await AlertNotificationOutbox.create({
      organization: incident.organization,
      incident: incident._id,
      event,
      idempotencyKey,
      payload: {
        recipients: subscription.emails,
        title: incident.title,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        occurredAt: new Date().toISOString(),
        incidentId: String(incident._id),
      },
    })
  } catch (error) {
    if (error.code === 11000) return null
    throw error
  }
}
