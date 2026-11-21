import mongoose from 'mongoose'
import { GatewaySource } from '../models/gateway-source.model.js'
import { env } from '../config/env.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { decryptGatewaySecret, gatewaySignature, safeSignatureEqual } from '../utils/gateway-security.js'

export const verifyGatewaySignature = asyncHandler(async (request, _response, next) => {
  if (!mongoose.isValidObjectId(request.params.sourceId)) throw new AppError('Gateway source not found.', 404, 'GATEWAY_SOURCE_NOT_FOUND')
  const source = await GatewaySource.findById(request.params.sourceId).select('+secretCiphertext +secretIv +secretTag')
  if (!source || source.status !== 'active') throw new AppError('Gateway source is unavailable.', 404, 'GATEWAY_SOURCE_NOT_FOUND')
  const timestamp = request.get('x-gridpulse-timestamp')
  const signature = request.get('x-gridpulse-signature')
  const seconds = Number(timestamp)
  if (!timestamp || !Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
    throw new AppError('Gateway request timestamp is missing, invalid, or expired.', 401, 'GATEWAY_TIMESTAMP_INVALID')
  }
  if (!Buffer.isBuffer(request.rawBody)) throw new AppError('Signed raw request body is unavailable.', 400, 'GATEWAY_RAW_BODY_REQUIRED')
  let secret
  try { secret = decryptGatewaySecret(source, env.INTEGRATION_ENCRYPTION_KEY) }
  catch { throw new AppError('Gateway signing is not configured correctly.', 503, 'GATEWAY_SIGNING_UNAVAILABLE') }
  const expected = gatewaySignature(secret, timestamp, request.rawBody)
  if (!safeSignatureEqual(expected, signature)) throw new AppError('Gateway signature verification failed.', 401, 'GATEWAY_SIGNATURE_INVALID')
  request.gatewaySource = source
  next()
})
