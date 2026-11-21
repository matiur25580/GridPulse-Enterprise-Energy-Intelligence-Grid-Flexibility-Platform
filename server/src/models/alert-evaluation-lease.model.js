import mongoose from 'mongoose'

const alertEvaluationLeaseSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  ownerId: { type: String, default: null },
  leaseUntil: { type: Date, required: true, index: true },
}, { timestamps: true, versionKey: false })

export const AlertEvaluationLease = mongoose.model('AlertEvaluationLease', alertEvaluationLeaseSchema)
