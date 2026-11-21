import test from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { EnergyReading } from '../src/models/energy-reading.model.js'
import { Meter } from '../src/models/meter.model.js'
import { Facility } from '../src/models/facility.model.js'
import { TariffPlan } from '../src/models/tariff-plan.model.js'
import { EnergyBill } from '../src/models/energy-bill.model.js'
import { estimateAndSaveBill } from '../src/services/billing.service.js'

const mongoUri = process.env.MONGODB_URI

async function createFixture(t) {
  const organizationId = new mongoose.Types.ObjectId()
  const otherOrganizationId = new mongoose.Types.ObjectId()
  const facilityId = new mongoose.Types.ObjectId()
  const tariffId = new mongoose.Types.ObjectId()
  const userId = new mongoose.Types.ObjectId()

  await Facility.create({
    _id: facilityId, organization: organizationId, name: 'Integration facility',
    code: `INT-${facilityId.toString().slice(-8)}`, timezone: 'Asia/Kolkata',
    status: 'active', createdBy: userId,
  })
  await TariffPlan.create({
    _id: tariffId, organization: organizationId, facility: facilityId,
    name: 'Integration tariff', currency: 'INR', defaultRatePerKwh: 8,
    energyRates: [], demandChargePerKw: 0, fixedCharge: 0, taxRatePercent: 0,
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), effectiveTo: null,
    status: 'active', createdBy: userId,
  })

  t.after(async () => {
    await Promise.all([
      EnergyReading.deleteMany({ organization: { $in: [organizationId, otherOrganizationId] } }),
      Meter.deleteMany({ organization: { $in: [organizationId, otherOrganizationId] } }),
      EnergyBill.deleteMany({ organization: organizationId }),
      TariffPlan.deleteMany({ organization: organizationId }),
      Facility.deleteMany({ organization: organizationId }),
    ])
  })

  return { organizationId, otherOrganizationId, facilityId, tariffId, userId }
}

async function createMeter({ organizationId, facilityId, userId, meterType, name }) {
  return Meter.create({
    organization: organizationId, facility: facilityId, name,
    serialNumber: `${name}-${new mongoose.Types.ObjectId().toString().slice(-8)}`,
    meterType, status: 'active', createdBy: userId,
  })
}

async function createReading({ organizationId, facilityId, meter, energyKwh, externalId }) {
  return EnergyReading.create({
    organization: organizationId, facility: facilityId, meter: meter._id,
    externalId, recordedAt: new Date('2026-11-01T10:00:00.000Z'),
    energyKwh, demandKw: 2, powerFactor: 0.98, source: 'simulation', quality: 'valid',
  })
}

async function estimate(fixture) {
  return estimateAndSaveBill({
    organizationId: fixture.organizationId,
    userId: fixture.userId,
    input: { facilityId: fixture.facilityId, tariffId: fixture.tariffId, from: '2026-11-01', to: '2026-11-01' },
  })
}

test('billing aggregation against MongoDB', { skip: !mongoUri && 'Set MONGODB_URI to run real MongoDB billing integration tests' }, async (t) => {
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
  t.after(async () => { await mongoose.disconnect() })

  await t.test('isolates readings by tenant and excludes meters owned by another tenant', async (t) => {
    const fixture = await createFixture(t)
    const mainMeter = await createMeter({ ...fixture, meterType: 'main', name: 'tenant-main' })
    const foreignMeter = await createMeter({
      organizationId: fixture.otherOrganizationId, facilityId: fixture.facilityId,
      userId: fixture.userId, meterType: 'main', name: 'foreign-main',
    })
    await createReading({ ...fixture, meter: mainMeter, energyKwh: 5, externalId: 'tenant-reading' })
    // Deliberately inconsistent cross-tenant reference: the aggregation's $lookup must reject it.
    await createReading({ ...fixture, meter: foreignMeter, energyKwh: 900, externalId: 'foreign-meter-reading' })

    const bill = await estimate(fixture)
    assert.equal(bill.summary.totalEnergyKwh, 5)
    assert.equal(bill.coverage.meterSource, 'main')
    assert.equal(bill.summary.readingCount, 1)
  })

  await t.test('uses submeter readings only when the main-meter query is empty', async (t) => {
    const fixture = await createFixture(t)
    const submeter = await createMeter({ ...fixture, meterType: 'submeter', name: 'fallback-submeter' })
    await createReading({ ...fixture, meter: submeter, energyKwh: 7, externalId: 'submeter-reading' })

    const bill = await estimate(fixture)
    assert.equal(bill.summary.totalEnergyKwh, 7)
    assert.equal(bill.coverage.meterSource, 'submeter_fallback')
  })

  await t.test('prefers main-meter readings when both main meters and submeters have data', async (t) => {
    const fixture = await createFixture(t)
    const mainMeter = await createMeter({ ...fixture, meterType: 'main', name: 'preferred-main' })
    const submeter = await createMeter({ ...fixture, meterType: 'submeter', name: 'ignored-submeter' })
    await createReading({ ...fixture, meter: mainMeter, energyKwh: 11, externalId: 'main-reading' })
    await createReading({ ...fixture, meter: submeter, energyKwh: 70, externalId: 'submeter-reading' })

    const bill = await estimate(fixture)
    assert.equal(bill.summary.totalEnergyKwh, 11)
    assert.equal(bill.coverage.meterSource, 'main')
  })
})
