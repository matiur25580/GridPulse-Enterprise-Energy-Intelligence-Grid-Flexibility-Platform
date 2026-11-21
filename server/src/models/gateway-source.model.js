import mongoose from 'mongoose'

const meterMappingSchema = new mongoose.Schema({
  externalMeterId: { type: String, required: true, trim: true, maxlength: 120 },
  meter: { type: mongoose.Schema.Types.ObjectId, ref: 'Meter', required: true },
}, { _id: false })

const gatewaySourceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  provider: { type: String, enum: ['generic_hmac'], default: 'generic_hmac' },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  meterMappings: { type: [meterMappingSchema], required: true, validate: (values) => values.length >= 1 && values.length <= 100 },
  expectedIntervalMinutes: { type: Number, required: true, min: 1, max: 1440, default: 15 },
  secretCiphertext: { type: String, required: true, select: false },
  secretIv: { type: String, required: true, select: false },
  secretTag: { type: String, required: true, select: false },
  lastReceivedAt: Date,
  lastSuccessAt: Date,
  lastEventAt: Date,
  lastErrorAt: Date,
  receivedEvents: { type: Number, default: 0 },
  insertedEvents: { type: Number, default: 0 },
  duplicateEvents: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

gatewaySourceSchema.index({ organization: 1, name: 1 }, { unique: true })
gatewaySourceSchema.index({ organization: 1, status: 1, lastSuccessAt: 1 })
export const GatewaySource = mongoose.model('GatewaySource', gatewaySourceSchema)
