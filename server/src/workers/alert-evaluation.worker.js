import { randomUUID } from 'node:crypto'
import { AlertRule } from '../models/alert-rule.model.js'
import { AlertEvaluationLease } from '../models/alert-evaluation-lease.model.js'
import { AlertEvaluationRun } from '../models/alert-evaluation-run.model.js'
import { evaluateEnergyAlerts } from '../services/alerts.service.js'
import { env } from '../config/env.js'

const LEASE_ID = 'gridpulse-alert-evaluation'
let timer
let activeRun = null

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

async function renewLease(ownerId) {
  const leaseUntil = new Date(Date.now() + env.ALERT_EVALUATION_LEASE_SECONDS * 1000)
  const result = await AlertEvaluationLease.updateOne({ _id: LEASE_ID, ownerId }, { $set: { leaseUntil } })
  return result.matchedCount === 1
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
        errorCode: error.name === 'AppError' && typeof error.code === 'string' ? error.code.slice(0, 80) : 'EVALUATION_FAILED',
        errorMessage: 'Alert evaluation failed. Review protected server logs for details.',
      },
    })
    console.error('GridPulse scheduled alert evaluation failed:', { organizationId: String(organizationId), error })
  }
}

async function executeScheduledAlertEvaluation() {
  const ownerId = randomUUID()
  const acquired = await acquireLease(ownerId)
  if (!acquired) return { skipped: true, reason: 'lease_held' }
  const heartbeat = setInterval(() => {
    renewLease(ownerId).then(renewed => {
      if (!renewed) console.error('GridPulse alert evaluation lease ownership was lost.')
    }).catch(error => console.error('GridPulse alert lease renewal failed:', error))
  }, Math.max(20_000, Math.floor(env.ALERT_EVALUATION_LEASE_SECONDS * 1000 / 3)))
  heartbeat.unref?.()
  try {
    const organizations = await AlertRule.distinct('organization', { status: 'active' })
    for (const organizationId of organizations) await evaluateOrganization(organizationId)
    return { skipped: false, organizations: organizations.length }
  } finally {
    clearInterval(heartbeat)
    await releaseLease(ownerId)
  }
}

export function runScheduledAlertEvaluation() {
  if (activeRun) return Promise.resolve({ skipped: true, reason: 'worker_busy' })
  activeRun = executeScheduledAlertEvaluation().finally(() => { activeRun = null })
  return activeRun
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

export async function stopAlertEvaluationWorker() {
  if (timer) clearInterval(timer)
  timer = undefined
  if (activeRun) await activeRun
}
