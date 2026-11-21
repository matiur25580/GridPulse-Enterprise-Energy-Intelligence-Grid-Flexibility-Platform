import mongoose from 'mongoose'
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
export const Organization = mongoose.model('Organization', organizationSchema)
