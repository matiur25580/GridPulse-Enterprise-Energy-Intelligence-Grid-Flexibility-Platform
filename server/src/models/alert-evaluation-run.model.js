import mongoose from 'mongoose'

const alertEvaluationRunSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  trigger: { type: String, enum: ['scheduler', 'manual'], required: true },
  status: { type: String, enum: ['running', 'succeeded', 'partial', 'failed'], required: true, index: true },
  startedAt: { type: Date, required: true },
  finishedAt: Date,
  durationMs: { type: Number, min: 0 },
  evaluatedRules: { type: Number, default: 0, min: 0 },
  created: { type: Number, default: 0, min: 0 },
  updated: { type: Number, default: 0, min: 0 },
  recovered: { type: Number, default: 0, min: 0 },
  clear: { type: Number, default: 0, min: 0 },
  skipped: { type: Number, default: 0, min: 0 },
  errorCode: { type: String, maxlength: 80 },
  errorMessage: { type: String, maxlength: 500 },
}, { timestamps: true })

alertEvaluationRunSchema.index({ organization: 1, startedAt: -1 })
export const AlertEvaluationRun = mongoose.model('AlertEvaluationRun', alertEvaluationRunSchema)
