import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { env } from '../src/config/env.js'
import { User } from '../src/models/user.model.js'
import { Organization } from '../src/models/organization.model.js'
import { Membership } from '../src/models/membership.model.js'
import { Facility } from '../src/models/facility.model.js'
import { Meter } from '../src/models/meter.model.js'
import { EnergyReading } from '../src/models/energy-reading.model.js'
import { TariffPlan } from '../src/models/tariff-plan.model.js'
import { AlertRule } from '../src/models/alert-rule.model.js'
import { EnergyIncident } from '../src/models/energy-incident.model.js'
import { AlertNotificationSubscription } from '../src/models/alert-notification-subscription.model.js'

const DEMO_EMAIL = (process.env.DEMO_SEED_EMAIL || 'demo@gridpulse.local').trim().toLowerCase()
const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD
const HISTORY_DAYS = 60
const HOUR_MS = 60 * 60 * 1000

if (env.NODE_ENV === 'production') {
  throw new Error('The demo seeder refuses to run when NODE_ENV=production.')
}
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12 || !/[a-z]/.test(DEMO_PASSWORD) ||
    !/[A-Z]/.test(DEMO_PASSWORD) || !/[0-9]/.test(DEMO_PASSWORD)) {
  throw new Error('Set DEMO_SEED_PASSWORD to a 12+ character password with uppercase, lowercase and a number.')
}

const facilitySpecs = [
  { code: 'KOL-CAMPUS', name: 'Kolkata Operations Campus', facilityType: 'campus', city: 'Kolkata', region: 'West Bengal', baseLoad: 94, solarPeak: 48 },
  { code: 'PUN-PLANT', name: 'Pune Manufacturing Plant', facilityType: 'industrial', city: 'Pune', region: 'Maharashtra', baseLoad: 148, solarPeak: 36 },
  { code: 'BLR-HUB', name: 'Bengaluru Distribution Hub', facilityType: 'warehouse', city: 'Bengaluru', region: 'Karnataka', baseLoad: 112, solarPeak: 0 },
  { code: 'HYD-RETAIL', name: 'Hyderabad Retail Cluster', facilityType: 'retail', city: 'Hyderabad', region: 'Telangana', baseLoad: 76, solarPeak: 0 },
]

function stableWave(value) {
  return Math.sin(value * 12.9898) * 0.5 + Math.cos(value * 4.1414) * 0.25
}

function energyFor(meter, hourIndex, timestamp) {
  const hour = timestamp.getUTCHours()
  const weekday = timestamp.getUTCDay()
  const workdayFactor = weekday === 0 ? 0.78 : weekday === 6 ? 0.9 : 1
  const dailyShape = 0.78 + 0.22 * Math.cos(((hour - 14) / 24) * Math.PI * 2)
  const slowSeasonality = 1 + 0.06 * Math.sin(hourIndex / (24 * 11))
  const noise = 1 + stableWave(hourIndex + meter.offset) * 0.045

  if (meter.meterType === 'solar') {
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
    const cloud = 0.88 + 0.12 * Math.sin((hourIndex + meter.offset) / 17)
    return Number((meter.solarPeak * daylight * cloud).toFixed(3))
  }
  const base = meter.meterType === 'submeter' ? meter.baseLoad * 0.23 : meter.baseLoad
  const shift = meter.meterType === 'submeter' ? 0.92 + 0.08 * Math.sin(hour / 24 * Math.PI * 2) : 1
  return Number(Math.max(0.1, base * dailyShape * workdayFactor * slowSeasonality * noise * shift).toFixed(3))
}

async function upsertReadingBatch(operations) {
  if (operations.length) await EnergyReading.bulkWrite(operations, { ordered: false })
}

async function seed() {
  await connectDatabase()
  try {
    let user = await User.findOne({ email: DEMO_EMAIL })
    if (!user) {
      user = await User.create({
        name: 'GridPulse Demo Operator',
        email: DEMO_EMAIL,
        passwordHash: DEMO_PASSWORD,
        status: 'active',
      })
    }

    const organization = await Organization.findOneAndUpdate(
      { slug: 'gridpulse-demo' },
      { $setOnInsert: { name: 'GridPulse Demonstration Portfolio', slug: 'gridpulse-demo', status: 'active', createdBy: user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    await Membership.updateOne(
      { user: user._id, organization: organization._id },
      { $set: { role: 'owner', status: 'active' } },
      { upsert: true },
    )

    const facilities = []
    const meters = []
    for (const spec of facilitySpecs) {
      const facility = await Facility.findOneAndUpdate(
        { organization: organization._id, code: spec.code },
        { $set: {
          name: spec.name, facilityType: spec.facilityType, timezone: 'Asia/Kolkata',
          address: { city: spec.city, region: spec.region, country: 'India' },
          status: 'active',
        }, $setOnInsert: { organization: organization._id, code: spec.code, createdBy: user._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      facilities.push({ ...spec, document: facility })

      const meterSpecs = [
        { suffix: 'MAIN', name: spec.name + ' — Main incomer', meterType: 'main', baseLoad: spec.baseLoad, solarPeak: 0, offset: facilities.length * 7 },
        { suffix: 'HVAC', name: spec.name + ' — HVAC submeter', meterType: 'submeter', baseLoad: spec.baseLoad, solarPeak: 0, offset: facilities.length * 13 },
      ]
      if (spec.solarPeak > 0) meterSpecs.push({
        suffix: 'SOLAR', name: spec.name + ' — Rooftop solar', meterType: 'solar',
        baseLoad: 0, solarPeak: spec.solarPeak, offset: facilities.length * 19,
      })

      for (const meterSpec of meterSpecs) {
        const serialNumber = spec.code + '-' + meterSpec.suffix
        const meter = await Meter.findOneAndUpdate(
          { organization: organization._id, serialNumber },
          { $set: {
            facility: facility._id, name: meterSpec.name, meterType: meterSpec.meterType,
            unit: 'kWh', ratedPowerKw: Math.max(20, spec.baseLoad * 1.8), status: 'active',
          }, $setOnInsert: { organization: organization._id, serialNumber, createdBy: user._id, installedAt: new Date(Date.now() - 365 * 86400000) } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        meters.push({ ...meterSpec, document: meter })
      }
    }

    const start = new Date()
    start.setUTCMinutes(0, 0, 0)
    start.setTime(start.getTime() - (HISTORY_DAYS - 1) * 24 * HOUR_MS)
    let operations = []
    let readingOperations = 0
    for (let meterIndex = 0; meterIndex < meters.length; meterIndex += 1) {
      const meter = meters[meterIndex]
      const facility = facilities.find(item => item.document._id.equals(meter.document.facility))
      for (let hourIndex = 0; hourIndex < HISTORY_DAYS * 24; hourIndex += 1) {
        const recordedAt = new Date(start.getTime() + hourIndex * HOUR_MS)
        const energyKwh = energyFor({ ...meter, baseLoad: meter.baseLoad || facility.baseLoad }, hourIndex, recordedAt)
        const quality = (hourIndex + meterIndex * 17) % 211 === 0
          ? 'flagged'
          : (hourIndex + meterIndex * 11) % 97 === 0 ? 'estimated' : 'valid'
        const externalId = 'demo-' + meter.document._id.toString() + '-' + recordedAt.toISOString()
        const reading = {
          organization: organization._id,
          facility: facility.document._id,
          meter: meter.document._id,
          externalId,
          recordedAt,
          energyKwh,
          source: 'simulation',
          quality,
          ...(meter.meterType === 'solar' ? {} : {
            demandKw: Number((energyKwh * (1.08 + Math.max(0, Math.sin(recordedAt.getUTCHours() / 24 * Math.PI)) * 0.18)).toFixed(3)),
            voltageV: Number((408 + stableWave(hourIndex + meterIndex) * 5).toFixed(2)),
            currentA: Number((energyKwh * 2.35).toFixed(2)),
            powerFactor: Number((0.94 + Math.abs(stableWave(hourIndex + meterIndex * 2)) * 0.045).toFixed(3)),
          }),
        }
        operations.push({
          updateOne: {
            filter: { organization: organization._id, meter: meter.document._id, externalId },
            update: { $setOnInsert: reading },
            upsert: true,
          },
        })
        readingOperations += 1
        if (operations.length >= 1000) {
          await upsertReadingBatch(operations)
          operations = []
        }
      }
    }
    await upsertReadingBatch(operations)

    for (const facility of facilities) {
      await TariffPlan.findOneAndUpdate(
        { organization: organization._id, facility: facility.document._id, name: 'GridPulse Demo TOU Tariff' },
        { $set: {
          currency: 'INR', defaultRatePerKwh: 8.25,
          energyRates: [
            { label: 'Peak', ratePerKwh: 12.5, hours: [17, 18, 19, 20], daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
            { label: 'Off-peak', ratePerKwh: 6.25, hours: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23], daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
          ],
          demandChargePerKw: 185, fixedCharge: 1250, taxRatePercent: 5,
          effectiveFrom: start, effectiveTo: null, status: 'active',
        }, $setOnInsert: { organization: organization._id, facility: facility.document._id, name: 'GridPulse Demo TOU Tariff', createdBy: user._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }

    const incidentFacility = facilities.find(item => item.facilityType === 'industrial')
    const alertRule = await AlertRule.findOneAndUpdate(
      { organization: organization._id, name: 'Manufacturing demand watch' },
      { $set: {
        type: 'high_consumption', target: incidentFacility.document._id, targetType: 'facility',
        thresholdKwh: 120, windowMinutes: 60, severity: 'high', status: 'active',
      }, $setOnInsert: { organization: organization._id, name: 'Manufacturing demand watch', createdBy: user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    const incidentNow = new Date()
    await EnergyIncident.findOneAndUpdate(
      { organization: organization._id, fingerprint: 'demo-manufacturing-demand-watch', status: { $in: ['open', 'acknowledged'] } },
      { $set: {
        rule: alertRule._id, type: 'high_consumption',
        title: 'Manufacturing demand above operating threshold',
        description: 'Synthetic demonstration incident showing the operator acknowledgement and resolution workflow.',
        severity: 'high', status: 'acknowledged',
        firstSeenAt: new Date(incidentNow.getTime() - 4 * 3600000), lastSeenAt: incidentNow,
        occurrences: 4, observedValue: 146.8, thresholdValue: 120, unit: 'kWh',
        acknowledgedAt: new Date(incidentNow.getTime() - 2 * 3600000), acknowledgedBy: user._id,
      }, $setOnInsert: { organization: organization._id, fingerprint: 'demo-manufacturing-demand-watch' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    await AlertNotificationSubscription.findOneAndUpdate(
      { organization: organization._id },
      { $set: { enabled: false, emails: [], updatedBy: user._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    console.info(JSON.stringify({
      message: 'GridPulse demo organization seeded successfully.',
      organization: organization.name,
      organizationId: organization._id.toString(),
      email: DEMO_EMAIL,
      password: 'Use the DEMO_SEED_PASSWORD value supplied to this command; it is not printed.',
      facilities: facilities.length,
      meters: meters.length,
      readingPointsConsidered: readingOperations,
      historyDays: HISTORY_DAYS,
      tariffs: facilities.length,
      alertRules: 1,
      demonstrationIncidents: 1,
      source: 'synthetic simulation data',
    }, null, 2))
  } finally {
    await disconnectDatabase()
  }
}

seed().catch(error => {
  console.error('GridPulse demo seeding failed:', error.message)
  process.exitCode = 1
})
