import mongoose from 'mongoose'

const alertNotificationOutboxSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  incident: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyIncident', required: true },
  event: { type: String, enum: ['incident_opened', 'incident_recovered', 'incident_resolved'], required: true },
  idempotencyKey: { type: String, required: true, unique: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'processing', 'sent', 'dead'], default: 'pending', index: true },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lockedUntil: Date,
  deliveredAt: Date,
  lastError: { type: String, maxlength: 300 },
}, { timestamps: true })

alertNotificationOutboxSchema.index({ status: 1, nextAttemptAt: 1, lockedUntil: 1 })
alertNotificationOutboxSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 })
export const AlertNotificationOutbox = mongoose.model('AlertNotificationOutbox', alertNotificationOutboxSchema)
