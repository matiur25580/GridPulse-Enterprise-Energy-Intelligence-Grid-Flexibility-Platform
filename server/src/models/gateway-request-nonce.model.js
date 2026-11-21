import mongoose from 'mongoose'

const gatewayRequestNonceSchema = new mongoose.Schema({
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'GatewaySource', required: true },
  signature: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true })

gatewayRequestNonceSchema.index({ source: 1, signature: 1 }, { unique: true })
gatewayRequestNonceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const GatewayRequestNonce = mongoose.model('GatewayRequestNonce', gatewayRequestNonceSchema)
