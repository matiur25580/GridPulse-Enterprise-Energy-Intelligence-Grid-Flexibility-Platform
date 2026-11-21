import { AlertRule } from '../models/alert-rule.model.js'
import { AlertEvaluationRun } from '../models/alert-evaluation-run.model.js'
import { EnergyIncident } from '../models/energy-incident.model.js'
import { EnergyReading } from '../models/energy-reading.model.js'
import { Meter } from '../models/meter.model.js'
import { Facility } from '../models/facility.model.js'
import { GatewaySource } from '../models/gateway-source.model.js'
import { AppError } from '../utils/app-error.js'
import { exceedsEnergyThreshold, isAlertStale } from '../utils/alert-conditions.js'

async function assertRuleTarget({ organizationId, targetId, targetType }) {
  const Model = targetType === 'facility' ? Facility : targetType === 'meter' ? Meter : GatewaySource
  const target = await Model.findOne({ _id: targetId, organization: organizationId }).select('_id status').lean()
  if (!target || (targetType === 'facility' && target.status !== 'active') || (targetType === 'meter' && target.status !== 'active') || (targetType === 'gateway' && target.status !== 'active')) {
    throw new AppError('Alert target must exist and be active in this organization.', 422, 'ALERT_TARGET_INVALID')
  }
}

export async function createAlertRule({ organizationId, userId, input }) {
  const targetType = input.targetType
  const allowed = input.type === 'high_consumption'
    ? ['facility', 'meter']
    : input.type === 'meter_silent' ? ['meter'] : ['gateway']
  if (!allowed.includes(targetType)) throw new AppError('The selected target type is not valid for this alert.', 422, 'ALERT_TARGET_TYPE_INVALID')
  await assertRuleTarget({ organizationId, targetId: input.targetId, targetType })
  const { targetId, ...ruleInput } = input
  return AlertRule.create({ organization: organizationId, createdBy: userId, ...ruleInput, target: targetId })
}

export async function listAlertRules({ organizationId }) {
  return AlertRule.find({ organization: organizationId }).sort({ createdAt: -1 }).lean()
}

export async function setAlertRuleStatus({ organizationId, ruleId, status }) {
  const rule = await AlertRule.findOneAndUpdate({ _id: ruleId, organization: organizationId }, { $set: { status } }, { new: true })
  if (!rule) throw new AppError('Alert rule not found in this organization.', 404, 'ALERT_RULE_NOT_FOUND')
  return rule
}

export async function listEnergyIncidents({ organizationId, filters }) {
  return EnergyIncident.find({ organization: organizationId, ...(filters.status ? { status: filters.status } : {}), ...(filters.severity ? { severity: filters.severity } : {}) })
    .populate('rule', 'name type')
    .sort({ lastSeenAt: -1 }).limit(filters.limit).lean()
}

async function inspectRule(rule, now) {
  if (rule.type === 'high_consumption') {
    const TargetModel = rule.targetType === 'facility' ? Facility : Meter
    const activeTarget = await TargetModel.findOne({ _id: rule.target, organization: rule.organization, status: 'active' }).select('_id').lean()
    if (!activeTarget) return { triggered: false }
    const since = new Date(now.getTime() - rule.windowMinutes * 60_000)
    const match = { organization: rule.organization, recordedAt: { $gte: since, $lte: now }, quality: { $in: ['valid', 'estimated'] } }
    if (rule.targetType === 'meter') match.meter = rule.target
    else match.facility = rule.target
    const [totals] = await EnergyReading.aggregate([
      { $match: match },
      { $group: { _id: null, energyKwh: { $sum: '$energyKwh' }, readings: { $sum: 1 } } },
    ])
    const observed = totals?.energyKwh ?? 0
    if (totals?.readings && exceedsEnergyThreshold(observed, rule.thresholdKwh)) {
      return { triggered: true, observedValue: observed, thresholdValue: rule.thresholdKwh, unit: 'kWh', title: rule.name, description: `${observed.toFixed(2)} kWh observed in ${rule.windowMinutes} minutes; configured threshold is ${rule.thresholdKwh} kWh.` }
    }
    return { triggered: false }
  }

  if (rule.type === 'meter_silent') {
    const meter = await Meter.findOne({ _id: rule.target, organization: rule.organization, status: 'active' }).select('name serialNumber').lean()
    if (!meter) return { triggered: false }
    const latest = await EnergyReading.findOne({ organization: rule.organization, meter: rule.target }).sort({ recordedAt: -1 }).select('recordedAt').lean()
    if (isAlertStale(latest?.recordedAt, rule.staleAfterMinutes, now)) {
      const minutes = latest?.recordedAt ? Math.floor((now - new Date(latest.recordedAt)) / 60_000) : null
      return { triggered: true, observedValue: minutes, thresholdValue: rule.staleAfterMinutes, unit: 'minutes', title: rule.name, description: minutes == null ? `Meter ${meter.name} (${meter.serialNumber}) has never delivered a reading.` : `Meter ${meter.name} (${meter.serialNumber}) has not reported for ${minutes} minutes.` }
    }
    return { triggered: false }
  }

  const gateway = await GatewaySource.findOne({ _id: rule.target, organization: rule.organization, status: 'active' }).select('name lastSuccessAt expectedIntervalMinutes').lean()
  if (!gateway) return { triggered: false }
  const stale = isAlertStale(gateway.lastSuccessAt, rule.staleAfterMinutes, now)
  if (stale) {
    const minutes = gateway.lastSuccessAt ? Math.floor((now - new Date(gateway.lastSuccessAt)) / 60_000) : null
    return { triggered: true, observedValue: minutes, thresholdValue: rule.staleAfterMinutes, unit: 'minutes', title: rule.name, description: minutes == null ? `Gateway ${gateway.name} has never completed a successful delivery.` : `Gateway ${gateway.name} has not completed a successful delivery for ${minutes} minutes.` }
  }
  return { triggered: false }
}

async function recordCondition({ rule, condition, now, userId }) {
  const fingerprint = `rule:${rule._id}:target:${rule.target}`
  const active = await EnergyIncident.findOne({ organization: rule.organization, fingerprint, status: { $in: ['open', 'acknowledged'] } })
  if (!condition.triggered) {
    if (active) {
      active.status = 'resolved'
      active.resolvedAt = now
      active.resolvedBy = userId ?? undefined
      active.resolutionReason = 'condition_cleared'
      await active.save()
      return 'recovered'
    }
    return 'clear'
  }
  if (active) {
    active.lastSeenAt = now
    active.occurrences += 1
    active.observedValue = condition.observedValue
    active.thresholdValue = condition.thresholdValue
    active.description = condition.description
    await active.save()
    return 'updated'
  }
  try {
    await EnergyIncident.create({
      organization: rule.organization, rule: rule._id, fingerprint, type: rule.type,
      title: condition.title, description: condition.description, severity: rule.severity,
      firstSeenAt: now, lastSeenAt: now, occurrences: 1,
      observedValue: condition.observedValue, thresholdValue: condition.thresholdValue, unit: condition.unit,
    })
    return 'created'
  } catch (error) {
    if (error.code !== 11000) throw error
    await EnergyIncident.updateOne({ organization: rule.organization, fingerprint, status: { $in: ['open', 'acknowledged'] } }, {
      $set: { lastSeenAt: now, observedValue: condition.observedValue, thresholdValue: condition.thresholdValue, description: condition.description },
      $inc: { occurrences: 1 },
    })
    return 'updated'
  }
}

export async function evaluateEnergyAlerts({ organizationId, now = new Date(), userId }) {
  const rules = await AlertRule.find({ organization: organizationId }).lean()
  const summary = { evaluatedRules: rules.length, created: 0, updated: 0, recovered: 0, clear: 0, skipped: 0 }
  for (const rule of rules) {
    if (rule.status !== 'active') {
      const result = await recordCondition({ rule, condition: { triggered: false }, now, userId })
      summary[result] += 1
      continue
    }
    const condition = await inspectRule(rule, now)
    const result = await recordCondition({ rule, condition, now, userId })
    summary[result] += 1
  }
  return summary
}

export async function updateIncidentStatus({ organizationId, incidentId, status, userId }) {
  const incident = await EnergyIncident.findOne({ _id: incidentId, organization: organizationId, status: { $in: ['open', 'acknowledged'] } })
  if (!incident) throw new AppError('An active incident with this identifier was not found.', 404, 'ACTIVE_INCIDENT_NOT_FOUND')
  if (status === 'acknowledged') {
    incident.status = 'acknowledged'
    incident.acknowledgedAt = new Date()
    incident.acknowledgedBy = userId
  } else {
    incident.status = 'resolved'
    incident.resolvedAt = new Date()
    incident.resolvedBy = userId
    incident.resolutionReason = 'operator_resolved'
  }
  await incident.save()
  return incident
}

export async function listAlertEvaluations({ organizationId, limit = 20 }) {
  return AlertEvaluationRun.find({ organization: organizationId }).sort({ startedAt: -1 }).limit(limit).lean()
}
