import mongoose from 'mongoose'

const meterSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  serialNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
  meterType: { type: String, enum: ['main', 'submeter', 'solar', 'battery', 'ev_charger', 'generator'], default: 'main' },
  unit: { type: String, enum: ['kWh'], default: 'kWh' },
  ratedPowerKw: { type: Number, min: 0 },
  status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active', index: true },
  installedAt: Date,
  metadata: { type: Map, of: String, default: undefined },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

meterSchema.index({ organization: 1, serialNumber: 1 }, { unique: true })
meterSchema.index({ organization: 1, facility: 1, status: 1 })
export const Meter = mongoose.model('Meter', meterSchema)
