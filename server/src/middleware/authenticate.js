import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { User } from '../models/user.model.js'

// Verify the access token, then confirm the referenced account is still active before trusting it.
export const authenticate = asyncHandler(async (request, _response, next) => {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) throw new AppError('Authentication is required.', 401, 'UNAUTHENTICATED')
  let payload
  try {
    payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET, { issuer: 'gridpulse-api', audience: 'gridpulse-client' })
  } catch {
    throw new AppError('Access token is invalid or expired.', 401, 'INVALID_ACCESS_TOKEN')
  }
  const user = await User.findById(payload.sub).select('_id name email status')
  if (!user || user.status !== 'active') throw new AppError('This account is unavailable.', 401, 'ACCOUNT_UNAVAILABLE')
  request.user = { id: user.id, name: user.name, email: user.email }
  next()
})
