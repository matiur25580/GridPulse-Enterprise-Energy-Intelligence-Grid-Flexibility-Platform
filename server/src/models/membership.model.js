import mongoose from 'mongoose'

const membershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  role: { type: String, enum: ['owner', 'admin', 'operator', 'analyst', 'viewer'], required: true },
  status: { type: String, enum: ['active', 'revoked'], default: 'active', index: true },
}, { timestamps: true })

membershipSchema.index({ user: 1, organization: 1 }, { unique: true })
export const Membership = mongoose.model('Membership', membershipSchema)
