import mongoose from 'mongoose'

const energyReadingSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  meter: { type: mongoose.Schema.Types.ObjectId, ref: 'Meter', required: true },
  externalId: { type: String, required: true, trim: true, maxlength: 120 },
  recordedAt: { type: Date, required: true },
  energyKwh: { type: Number, required: true, min: 0 },
  demandKw: { type: Number, min: 0 },
  voltageV: { type: Number, min: 0 },
  currentA: { type: Number, min: 0 },
  powerFactor: { type: Number, min: 0, max: 1 },
  source: { type: String, enum: ['manual', 'gateway', 'import', 'simulation'], default: 'manual' },
  quality: { type: String, enum: ['valid', 'estimated', 'flagged'], default: 'valid' },
  metadata: { type: Map, of: String, default: undefined },
}, { timestamps: true })

energyReadingSchema.index({ organization: 1, meter: 1, externalId: 1 }, { unique: true })
energyReadingSchema.index({ organization: 1, meter: 1, recordedAt: -1 })
energyReadingSchema.index({ organization: 1, facility: 1, recordedAt: -1 })
export const EnergyReading = mongoose.model('EnergyReading', energyReadingSchema)
