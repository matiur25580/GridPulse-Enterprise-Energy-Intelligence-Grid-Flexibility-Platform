import mongoose from 'mongoose'

const energyIncidentSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  rule: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule', required: true },
  fingerprint: { type: String, required: true },
  type: { type: String, enum: ['high_consumption', 'meter_silent', 'gateway_silent'], required: true },
  title: { type: String, required: true, maxlength: 180 },
  description: { type: String, required: true, maxlength: 1000 },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open', index: true },
  firstSeenAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  occurrences: { type: Number, default: 1, min: 1 },
  observedValue: Number,
  thresholdValue: Number,
  unit: { type: String, maxlength: 20 },
  acknowledgedAt: Date,
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

energyIncidentSchema.index({ organization: 1, status: 1, severity: 1, lastSeenAt: -1 })
energyIncidentSchema.index({ organization: 1, fingerprint: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['open', 'acknowledged'] } },
})
export const EnergyIncident = mongoose.model('EnergyIncident', energyIncidentSchema)
