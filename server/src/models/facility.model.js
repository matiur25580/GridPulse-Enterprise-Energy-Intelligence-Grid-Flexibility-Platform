import mongoose from 'mongoose'

const facilitySchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  facilityType: { type: String, enum: ['office', 'industrial', 'warehouse', 'retail', 'campus', 'other'], default: 'other' },
  timezone: { type: String, required: true, default: 'UTC', maxlength: 64 },
  address: {
    line1: { type: String, trim: true, maxlength: 160 },
    city: { type: String, trim: true, maxlength: 80 },
    region: { type: String, trim: true, maxlength: 80 },
    postalCode: { type: String, trim: true, maxlength: 24 },
    country: { type: String, trim: true, maxlength: 80 },
  },
  status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

facilitySchema.index({ organization: 1, code: 1 }, { unique: true })
facilitySchema.index({ organization: 1, name: 1 })
export const Facility = mongoose.model('Facility', facilitySchema)
