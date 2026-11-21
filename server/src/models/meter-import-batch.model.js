import mongoose from 'mongoose'

const meterImportBatchSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  meter: { type: mongoose.Schema.Types.ObjectId, ref: 'Meter', required: true },
  externalBatchId: { type: String, required: true, trim: true, maxlength: 120 },
  fileName: { type: String, required: true, trim: true, maxlength: 180 },
  source: { type: String, enum: ['csv'], default: 'csv' },
  status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
  received: { type: Number, default: 0 },
  inserted: { type: Number, default: 0 },
  duplicates: { type: Number, default: 0 },
  errorSummary: { type: String, maxlength: 500 },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

meterImportBatchSchema.index({ organization: 1, meter: 1, externalBatchId: 1 }, { unique: true })
meterImportBatchSchema.index({ organization: 1, createdAt: -1 })
export const MeterImportBatch = mongoose.model('MeterImportBatch', meterImportBatchSchema)
