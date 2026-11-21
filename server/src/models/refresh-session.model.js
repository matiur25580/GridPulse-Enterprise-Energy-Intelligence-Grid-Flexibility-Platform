import mongoose from 'mongoose'

const refreshSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  revokedAt: Date,
  replacedByTokenHash: String,
  userAgent: { type: String, maxlength: 500 },
  ipAddress: { type: String, maxlength: 80 },
}, { timestamps: true })

refreshSessionSchema.index({ user: 1, revokedAt: 1 })
export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema)
