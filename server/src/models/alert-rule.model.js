import mongoose from 'mongoose'

const alertRuleSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['high_consumption', 'meter_silent', 'gateway_silent'], required: true },
  target: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['facility', 'meter', 'gateway'], required: true },
  thresholdKwh: { type: Number, min: 0 },
  windowMinutes: { type: Number, min: 5, max: 10080, default: 60 },
  staleAfterMinutes: { type: Number, min: 5, max: 10080, default: 60 },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['active', 'disabled'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

alertRuleSchema.index({ organization: 1, status: 1, type: 1 })
export const AlertRule = mongoose.model('AlertRule', alertRuleSchema)
