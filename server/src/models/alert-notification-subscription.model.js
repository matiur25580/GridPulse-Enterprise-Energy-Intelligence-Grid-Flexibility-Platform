import mongoose from 'mongoose'

const alertNotificationSubscriptionSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
  emails: { type: [String], default: [], validate: value => value.length <= 25 },
  enabled: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export const AlertNotificationSubscription = mongoose.model('AlertNotificationSubscription', alertNotificationSubscriptionSchema)
