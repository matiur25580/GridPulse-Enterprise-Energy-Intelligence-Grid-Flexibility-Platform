import mongoose from 'mongoose'

const utilityInvoiceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  facility: { type: mongoose.Schema.Types.ObjectId, ref: 'Facility', required: true },
  billEstimate: { type: mongoose.Schema.Types.ObjectId, ref: 'EnergyBill', required: true },
  invoiceNumber: { type: String, required: true, trim: true, maxlength: 120 },
  supplier: { type: String, required: true, trim: true, maxlength: 160 },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  currency: { type: String, required: true },
  actualEnergyKwh: { type: Number, required: true, min: 0 },
  actualAmount: { type: Number, required: true, min: 0 },
  actualDemandKw: { type: Number, min: 0, default: null },
  reconciliation: { type: mongoose.Schema.Types.Mixed, required: true },
  importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

utilityInvoiceSchema.index({ organization: 1, facility: 1, invoiceNumber: 1 }, { unique: true })
utilityInvoiceSchema.index({ organization: 1, periodStart: -1 })
export const UtilityInvoice = mongoose.model('UtilityInvoice', utilityInvoiceSchema)
