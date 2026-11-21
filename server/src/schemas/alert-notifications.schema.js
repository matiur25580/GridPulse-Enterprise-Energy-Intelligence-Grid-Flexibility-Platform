import { z } from 'zod'

const email = z.string().trim().email().max(254)
export const notificationSubscriptionSchema = z.object({
  enabled: z.boolean().default(true),
  emails: z.array(email).max(25).default([]),
}).strict().superRefine((value, context) => {
  const unique = new Set(value.emails.map(item => item.toLowerCase()))
  if (unique.size !== value.emails.length) context.addIssue({ code: 'custom', path: ['emails'], message: 'Recipient addresses must be unique.' })
  if (value.enabled && value.emails.length === 0) context.addIssue({ code: 'custom', path: ['emails'], message: 'Add at least one recipient or disable email notifications.' })
})
