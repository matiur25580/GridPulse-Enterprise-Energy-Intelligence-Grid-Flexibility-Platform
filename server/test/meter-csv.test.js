import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMeterReadingsCsv } from '../src/utils/meter-csv.js'

test('parses quoted CSV, optional measurements and BOM', () => {
  const csv = '\uFEFFexternalId,recordedAt,energyKwh,demandKw,quality\n"gateway,001",2026-11-01T10:00:00Z,12.5,4.2,valid'
  const [reading] = parseMeterReadingsCsv(csv)
  assert.equal(reading.externalId, 'gateway,001')
  assert.equal(reading.energyKwh, 12.5)
  assert.equal(reading.demandKw, 4.2)
  assert.equal(reading.source, 'import')
})

test('rejects missing columns, duplicate IDs and invalid numeric values', () => {
  assert.throws(() => parseMeterReadingsCsv('id,time\na,b'), { code: 'CSV_MISSING_COLUMNS' })
  assert.throws(() => parseMeterReadingsCsv('externalId,recordedAt,energyKwh\na,2026-11-01T00:00:00Z,1\na,2026-11-01T01:00:00Z,2'), { code: 'CSV_INVALID_EXTERNAL_ID' })
  assert.throws(() => parseMeterReadingsCsv('externalId,recordedAt,energyKwh\na,2026-11-01T00:00:00Z,-1'), { code: 'CSV_INVALID_READING' })
})

test('rejects malformed quoting and unsupported columns', () => {
  assert.throws(() => parseMeterReadingsCsv('externalId,recordedAt,energyKwh\n"a,2026-11-01,2'), { code: 'CSV_INVALID_QUOTING' })
  assert.throws(() => parseMeterReadingsCsv('externalId,recordedAt,energyKwh,secret\na,2026-11-01,2,x'), { code: 'CSV_UNKNOWN_COLUMNS' })
})

test('requires explicit timezone offsets and non-empty energy values', () => {
  assert.throws(() => parseMeterReadingsCsv('externalId,recordedAt,energyKwh\na,2026-11-01T10:00:00,1'), { code: 'CSV_INVALID_READING' })
  assert.throws(() => parseMeterReadingsCsv('externalId,recordedAt,energyKwh\na,2026-11-01T10:00:00Z,'), { code: 'CSV_INVALID_READING' })
})
