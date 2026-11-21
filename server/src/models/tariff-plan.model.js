import mongoose from 'mongoose'

const energyRateSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true, maxlength: 60 },
  ratePerKwh: { type: Number, required: true, min: 0, max: 100000 },
  hours: { type: [Number], required: true, validate: (values) => values.length >= 1 && values.every((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23) },
  daysOfWeek: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6], validate: (values) => values.length >= 1 && values.every((day) => Number.isInteger(day) && day >= 0 && day <= 6) },
}, { _id: false })

const tariffPlanSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  currency: { type: String, required: true, uppercase: true, enum: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'] },
  defaultRatePerKwh: { type: Number, required: true, min: 0, max: 100000 },
  energyRates: { type: [energyRateSchema], default: [] },
  demandChargePerKw: { type: Number, default: 0, min: 0, max: 1000000 },
  fixedCharge: { type: Number, default: 0, min: 0, max: 100000000 },
  taxRatePercent: { type: Number, default: 0, min: 0, max: 100 },
  effectiveFrom: { type: Date, required: true },
  effectiveTo: { type: Date, default: null },
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

tariffPlanSchema.index({ organization: 1, facility: 1, effectiveFrom: -1 })
export const TariffPlan = mongoose.model('TariffPlan', tariffPlanSchema)
