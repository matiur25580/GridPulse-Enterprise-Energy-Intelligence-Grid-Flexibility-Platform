import { randomUUID } from 'node:crypto'
import { AlertRule } from '../models/alert-rule.model.js'
import { AlertEvaluationLease } from '../models/alert-evaluation-lease.model.js'
import { AlertEvaluationRun } from '../models/alert-evaluation-run.model.js'
import { evaluateEnergyAlerts } from '../services/alerts.service.js'
import { env } from '../config/env.js'

const LEASE_ID = 'gridpulse-alert-evaluation'
let timer
let running = false

async function acquireLease(ownerId, now = new Date()) {
  const leaseUntil = new Date(now.getTime() + env.ALERT_EVALUATION_LEASE_SECONDS * 1000)
  try {
    const lease = await AlertEvaluationLease.findOneAndUpdate(
      { _id: LEASE_ID, $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }] },
      { $set: { ownerId, leaseUntil } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    return lease?.ownerId === ownerId
  } catch (error) {
    if (error.code === 11000) return false
    throw error
  }
}

async function releaseLease(ownerId) {
  await AlertEvaluationLease.updateOne(
    { _id: LEASE_ID, ownerId },
    { $set: { ownerId: null, leaseUntil: new Date(0) } },
  )
}

async function evaluateOrganization(organizationId) {
  const startedAt = new Date()
  const run = await AlertEvaluationRun.create({
    organization: organizationId, trigger: 'scheduler', status: 'running', startedAt,
  })
  try {
    const summary = await evaluateEnergyAlerts({ organizationId, now: startedAt })
    const finishedAt = new Date()
    await AlertEvaluationRun.updateOne({ _id: run._id }, {
      $set: { ...summary, status: 'succeeded', finishedAt, durationMs: finishedAt - startedAt },
    })
  } catch (error) {
    const finishedAt = new Date()
    await AlertEvaluationRun.updateOne({ _id: run._id }, {
      $set: {
        status: 'failed', finishedAt, durationMs: finishedAt - startedAt,
        errorCode: typeof error.code === 'string' ? error.code.slice(0, 80) : 'EVALUATION_FAILED',
        errorMessage: String(error.message || 'Alert evaluation failed').slice(0, 500),
      },
    })
    console.error('GridPulse scheduled alert evaluation failed:', { organizationId: String(organizationId), error })
  }
}

export async function runScheduledAlertEvaluation() {
  if (running) return { skipped: true, reason: 'worker_busy' }
  running = true
  const ownerId = randomUUID()
  try {
    const acquired = await acquireLease(ownerId)
    if (!acquired) return { skipped: true, reason: 'lease_held' }
    try {
      const organizations = await AlertRule.distinct('organization', { status: 'active' })
      for (const organizationId of organizations) await evaluateOrganization(organizationId)
      return { skipped: false, organizations: organizations.length }
    } finally {
      await releaseLease(ownerId)
    }
  } finally {
    running = false
  }
}

export function startAlertEvaluationWorker() {
  if (timer || env.ALERT_EVALUATION_INTERVAL_SECONDS === 0) return
  const intervalMs = env.ALERT_EVALUATION_INTERVAL_SECONDS * 1000
  timer = setInterval(() => {
    runScheduledAlertEvaluation().catch(error => console.error('GridPulse alert worker tick failed:', error))
  }, intervalMs)
  timer.unref?.()
  console.info(`GridPulse alert evaluator scheduled every ${env.ALERT_EVALUATION_INTERVAL_SECONDS} seconds`)
}

export function stopAlertEvaluationWorker() {
  if (timer) clearInterval(timer)
  timer = undefined
}
