import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { EnergyReading } from '../src/models/energy-reading.model.js'
import { Facility } from '../src/models/facility.model.js'
import { TariffPlan } from '../src/models/tariff-plan.model.js'
import { EnergyBill } from '../src/models/energy-bill.model.js'
import { estimateAndSaveBill } from '../src/services/billing.service.js'

const organizationId = new mongoose.Types.ObjectId()
const otherOrganizationId = new mongoose.Types.ObjectId()
const facilityId = new mongoose.Types.ObjectId()
const tariffId = new mongoose.Types.ObjectId()
const userId = new mongoose.Types.ObjectId()

const facility = {
  _id: facilityId,
  organization: organizationId,
  status: 'active',
  timezone: 'Asia/Kolkata',
}
const tariff = {
  _id: tariffId,
  organization: organizationId,
  facility: facilityId,
  status: 'active',
  effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
  effectiveTo: null,
  currency: 'INR',
  name: 'Test tariff',
  defaultRatePerKwh: 8,
  energyRates: [],
  demandChargePerKw: 100,
  fixedCharge: 0,
  taxRatePercent: 0,
}

function installModelStubs(t, aggregate) {
  const originals = {
    aggregate: EnergyReading.aggregate,
    facilityFindOne: Facility.findOne,
    tariffFindOne: TariffPlan.findOne,
    billFindOneAndUpdate: EnergyBill.findOneAndUpdate,
  }

  Facility.findOne = (filter) => {
    assert.equal(String(filter._id), String(facilityId))
    assert.equal(String(filter.organization), String(organizationId))
    return { lean: async () => facility }
  }
  TariffPlan.findOne = (filter) => {
    assert.equal(String(filter._id), String(tariffId))
    assert.equal(String(filter.organization), String(organizationId))
    assert.equal(String(filter.facility), String(facilityId))
    return { lean: async () => tariff }
  }
  EnergyReading.aggregate = aggregate

  let savedSnapshot
  EnergyBill.findOneAndUpdate = (_filter, update) => {
    savedSnapshot = update.$set
    return {
      populate() { return this },
      lean: async () => savedSnapshot,
    }
  }

  t.after(() => {
    EnergyReading.aggregate = originals.aggregate
    Facility.findOne = originals.facilityFindOne
    TariffPlan.findOne = originals.tariffFindOne
    EnergyBill.findOneAndUpdate = originals.billFindOneAndUpdate
  })

  return () => savedSnapshot
}

const input = {
  organizationId,
  userId,
  input: {
    facilityId,
    tariffId,
    from: '2026-11-01',
    to: '2026-11-01',
  },
}

const currentRows = [{
  _id: { date: '2026-11-01', hour: 10, dayOfWeek: 0 },
  energyKwh: 12,
  peakDemandKw: 3,
  averagePowerFactor: 0.98,
  readingCount: 1,
  estimatedReadings: 0,
}]

test('billing aggregation scopes readings and joined meters to the requested tenant and facility', async (t) => {
  const pipelines = []
  let call = 0
  installModelStubs(t, async (pipeline) => {
    pipelines.push(pipeline)
    call += 1
    if (call === 1) return currentRows
    return []
  })

  await estimateAndSaveBill(input)

  const currentPipeline = pipelines[0]
  const readingMatch = currentPipeline.find((stage) => stage.$match)?.$match
  assert.equal(String(readingMatch.organization), String(organizationId))
  assert.equal(String(readingMatch.facility), String(facilityId))
  assert.deepEqual(readingMatch.quality.$in, ['valid', 'estimated'])

  const meterLookup = currentPipeline.find((stage) => stage.$lookup)?.$lookup
  assert.equal(meterLookup.from, 'meters')
  const meterConditions = meterLookup.pipeline.find((stage) => stage.$match).$match.$expr.$and
  assert.ok(meterConditions.some((condition) => condition.$eq?.[0] === '$organization' && condition.$eq?.[1] === organizationId))
  assert.ok(meterConditions.some((condition) => condition.$eq?.[0] === '$facility' && condition.$eq?.[1] === facilityId))
  assert.ok(meterConditions.some((condition) => condition.$eq?.[0] === '$status' && condition.$eq?.[1] === 'active'))
  assert.ok(meterConditions.some((condition) => condition.$in?.[0] === '$meterType' && condition.$in?.[1].includes('main')))
  assert.ok(!meterConditions.some((condition) => condition.$eq?.[1] === otherOrganizationId))
})

test('billing falls back to submeters only when no main-meter readings exist', async (t) => {
  const meterTypesByCall = []
  const snapshots = installModelStubs(t, async (pipeline) => {
    const lookup = pipeline.find((stage) => stage.$lookup)?.$lookup
    const meterTypeCondition = lookup.pipeline.find((stage) => stage.$match).$match.$expr.$and
      .find((condition) => condition.$in?.[0] === '$meterType')
    const meterTypes = meterTypeCondition.$in[1]
    meterTypesByCall.push(meterTypes)
    if (meterTypes.includes('main') && meterTypesByCall.length === 1) return []
    if (meterTypes.includes('submeter') && meterTypesByCall.length === 2) return currentRows
    return []
  })

  const result = await estimateAndSaveBill(input)
  assert.deepEqual(meterTypesByCall.slice(0, 2), [['main'], ['submeter']])
  assert.equal(result.coverage.meterSource, 'submeter_fallback')
  assert.equal(result.summary.totalEnergyKwh, 12)
  assert.ok(snapshots())
})

test('billing uses main-meter readings before considering submeter fallback', async (t) => {
  const meterTypesByCall = []
  installModelStubs(t, async (pipeline) => {
    const lookup = pipeline.find((stage) => stage.$lookup)?.$lookup
    const meterTypeCondition = lookup.pipeline.find((stage) => stage.$match).$match.$expr.$and
      .find((condition) => condition.$in?.[0] === '$meterType')
    const meterTypes = meterTypeCondition.$in[1]
    meterTypesByCall.push(meterTypes)
    if (meterTypes.includes('main') && meterTypesByCall.length === 1) return currentRows
    return []
  })

  const result = await estimateAndSaveBill(input)
  assert.equal(result.coverage.meterSource, 'main')
  assert.deepEqual(meterTypesByCall.slice(0, 2), [['main'], ['main']])
  assert.deepEqual(meterTypesByCall.slice(0, 3), [['main'], ['main'], ['submeter']])
})
