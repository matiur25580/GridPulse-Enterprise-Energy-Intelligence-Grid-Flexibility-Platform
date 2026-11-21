import { AlertNotificationOutbox } from '../models/alert-notification-outbox.model.js'
import { env } from '../config/env.js'

const MAX_ATTEMPTS = 8
const BATCH_SIZE = 20
const LOCK_MS = 60_000
let timer
let activeRun = null

async function deliver(record) {
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_FROM) {
    const error = new Error('Email delivery is not configured.')
    error.permanent = true
    throw error
  }
  const { recipients, title, description, severity, status, incidentId } = record.payload
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': record.idempotencyKey },
    body: JSON.stringify({
      from: env.ALERT_EMAIL_FROM,
      to: recipients,
      subject: `[GridPulse ${severity.toUpperCase()}] ${title}`,
      text: [
        `GridPulse incident: ${title}`,
        `Severity: ${severity}`,
        `Status: ${status}`,
        '',
        description,
        '',
        `Incident ID: ${incidentId}`,
      ].join('\\n'),
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const error = new Error(`Email provider returned HTTP ${response.status}.`)
    error.permanent = response.status >= 400 && response.status < 500 && response.status !== 429
    throw error
  }
}

async function processOne() {
  const now = new Date()
  const record = await AlertNotificationOutbox.findOneAndUpdate({
    $or: [
      { status: 'pending', nextAttemptAt: { $lte: now } },
      { status: 'processing', lockedUntil: { $lte: now } },
    ],
  }, {
    $set: { status: 'processing', lockedUntil: new Date(now.getTime() + LOCK_MS) },
    $inc: { attempts: 1 },
  }, { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } })
  if (!record) return false
  try {
    await deliver(record)
    await AlertNotificationOutbox.updateOne({ _id: record._id, status: 'processing' }, {
      $set: { status: 'sent', deliveredAt: new Date(), lockedUntil: null, lastError: null },
    })
  } catch (error) {
    const permanent = error.permanent === true || record.attempts >= MAX_ATTEMPTS
    const delaySeconds = Math.min(3600, 30 * (2 ** Math.min(record.attempts - 1, 7)))
    await AlertNotificationOutbox.updateOne({ _id: record._id, status: 'processing' }, {
      $set: {
        status: permanent ? 'dead' : 'pending',
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
        lockedUntil: null,
        lastError: String(error.message || 'Delivery failed').slice(0, 300),
      },
    })
    console.error('GridPulse notification delivery failed:', { outboxId: String(record._id), attempt: record.attempts, permanent, error })
  }
  return true
}

export function runAlertNotificationBatch() {
  if (activeRun) return activeRun
  activeRun = (async () => {
    let processed = 0
    while (processed < BATCH_SIZE && await processOne()) processed += 1
    return { processed }
  })().finally(() => { activeRun = null })
  return activeRun
}

export function startAlertNotificationWorker() {
  if (timer || env.ALERT_NOTIFICATION_INTERVAL_SECONDS === 0) return
  if (!env.RESEND_API_KEY || !env.ALERT_EMAIL_FROM) {
    console.info('GridPulse email delivery is disabled until RESEND_API_KEY and ALERT_EMAIL_FROM are configured')
    return
  }
  timer = setInterval(() => {
    runAlertNotificationBatch().catch(error => console.error('GridPulse notification worker failed:', error))
  }, env.ALERT_NOTIFICATION_INTERVAL_SECONDS * 1000)
  timer.unref?.()
  console.info(`GridPulse notification outbox scheduled every ${env.ALERT_NOTIFICATION_INTERVAL_SECONDS} seconds`)
}

export async function stopAlertNotificationWorker() {
  if (timer) clearInterval(timer)
  timer = undefined
  if (activeRun) await activeRun
}
