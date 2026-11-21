import mongoose from 'mongoose'

const energyBillSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  tariff: { type: mongoose.Schema.Types.ObjectId, ref: 'TariffPlan', required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  currency: { type: String, required: true },
  status: { type: String, enum: ['estimate'], default: 'estimate' },
  calculationVersion: { type: String, default: '1.0.0' },
  tariffSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  summary: { type: mongoose.Schema.Types.Mixed, required: true },
  charges: { type: [mongoose.Schema.Types.Mixed], default: [] },
  daily: { type: [mongoose.Schema.Types.Mixed], default: [] },
  comparison: { type: mongoose.Schema.Types.Mixed, default: null },
  insights: { type: [mongoose.Schema.Types.Mixed], default: [] },
  coverage: { type: mongoose.Schema.Types.Mixed, required: true },
  generatedAt: { type: Date, default: Date.now },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

energyBillSchema.index({ organization: 1, facility: 1, tariff: 1, periodStart: 1, periodEnd: 1 }, { unique: true })
energyBillSchema.index({ organization: 1, periodStart: -1 })
export const EnergyBill = mongoose.model('EnergyBill', energyBillSchema)
