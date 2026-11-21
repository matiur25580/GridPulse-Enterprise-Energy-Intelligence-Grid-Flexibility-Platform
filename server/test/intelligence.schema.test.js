import test from 'node:test'
import assert from 'node:assert/strict'
import { intelligenceQuerySchema } from '../src/schemas/intelligence.schema.js'

test('intelligence query applies bounded defaults', () => {
  assert.deepEqual(intelligenceQuerySchema.parse({}), { historyDays: 30, horizonDays: 7 })
})

test('intelligence query accepts supported history and forecast windows', () => {
  assert.deepEqual(intelligenceQuerySchema.parse({ historyDays: '90', horizonDays: '14' }), { historyDays: 90, horizonDays: 14 })
})

test('intelligence query rejects excessive or insufficient windows', () => {
  assert.equal(intelligenceQuerySchema.safeParse({ historyDays: 6 }).success, false)
  assert.equal(intelligenceQuerySchema.safeParse({ horizonDays: 15 }).success, false)
})
