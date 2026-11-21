import { AppError } from './app-error.js'

function parseCsvRows(input) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"' && field.length === 0) quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1
      row.push(field); field = ''
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
    } else field += char
  }
  if (quoted) throw new AppError('CSV contains an unterminated quoted field.', 400, 'CSV_INVALID_QUOTING')
  row.push(field)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

export function parseMeterReadingsCsv(input) {
  if (typeof input !== 'string' || !input.trim()) throw new AppError('CSV content is required.', 400, 'CSV_EMPTY')
  if (Buffer.byteLength(input, 'utf8') > 900_000) throw new AppError('CSV content exceeds the 900 KB import limit.', 413, 'CSV_TOO_LARGE')
  const rows = parseCsvRows(input.replace(/^\uFEFF/, ''))
  if (rows.length < 2) throw new AppError('CSV must include a header and at least one reading.', 400, 'CSV_NO_READINGS')
  if (rows.length > 1001) throw new AppError('A CSV import can contain at most 1,000 readings.', 400, 'CSV_TOO_MANY_ROWS')
  const headers = rows[0].map((value) => value.trim())
  const required = ['externalId', 'recordedAt', 'energyKwh']
  const missing = required.filter((key) => !headers.includes(key))
  if (missing.length) throw new AppError('CSV is missing required columns: ' + missing.join(', '), 400, 'CSV_MISSING_COLUMNS')
  if (new Set(headers).size !== headers.length) throw new AppError('CSV header names must be unique.', 400, 'CSV_DUPLICATE_HEADERS')
  const allowed = new Set(['externalId', 'recordedAt', 'energyKwh', 'demandKw', 'voltageV', 'currentA', 'powerFactor', 'quality'])
  const unknown = headers.filter((key) => !allowed.has(key))
  if (unknown.length) throw new AppError('Unsupported CSV columns: ' + unknown.join(', '), 400, 'CSV_UNKNOWN_COLUMNS')
  const seen = new Set()
  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new AppError('CSV row ' + (index + 2) + ' has a different number of columns.', 400, 'CSV_ROW_WIDTH')
    const item = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]))
    if (!item.externalId || item.externalId.length > 120 || seen.has(item.externalId)) throw new AppError('CSV row ' + (index + 2) + ' has a missing, oversized, or duplicate externalId.', 400, 'CSV_INVALID_EXTERNAL_ID')
    seen.add(item.externalId)
    const recordedAt = new Date(item.recordedAt)
    const energyKwh = Number(item.energyKwh)
    if (!item.recordedAt || !Number.isFinite(recordedAt.getTime()) || !Number.isFinite(energyKwh) || energyKwh < 0 || energyKwh > 100_000_000) {
      throw new AppError('CSV row ' + (index + 2) + ' has an invalid timestamp or energyKwh value.', 400, 'CSV_INVALID_READING')
    }
    const reading = { externalId: item.externalId, recordedAt, energyKwh, source: 'import', quality: item.quality || 'valid' }
    for (const key of ['demandKw', 'voltageV', 'currentA', 'powerFactor']) {
      if (item[key] !== undefined && item[key] !== '') {
        const value = Number(item[key])
        const max = key === 'powerFactor' ? 1 : key === 'voltageV' ? 100_000 : key === 'currentA' ? 1_000_000 : 1_000_000
        if (!Number.isFinite(value) || value < 0 || value > max || (key === 'voltageV' && value === 0)) throw new AppError('CSV row ' + (index + 2) + ' has an invalid ' + key + '.', 400, 'CSV_INVALID_READING')
        reading[key] = value
      }
    }
    if (!['valid', 'estimated', 'flagged'].includes(reading.quality)) throw new AppError('CSV row ' + (index + 2) + ' has an invalid quality value.', 400, 'CSV_INVALID_READING')
    return reading
  })
}
