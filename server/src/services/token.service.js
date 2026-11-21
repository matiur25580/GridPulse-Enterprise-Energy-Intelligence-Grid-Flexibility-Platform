import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { RefreshSession } from '../models/refresh-session.model.js'
import { env } from '../config/env.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const newOpaqueToken = () => crypto.randomBytes(48).toString('base64url')

export function createAccessToken(user) {
  return jwt.sign({ email: user.email }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: 'gridpulse-api',
    audience: 'gridpulse-client',
    expiresIn: env.ACCESS_TOKEN_TTL,
  })
}

export async function createRefreshSession(user, request) {
  const token = newOpaqueToken()
  await RefreshSession.create({
    user: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
    userAgent: request.get('user-agent')?.slice(0, 500),
    ipAddress: request.ip,
  })
  return token
}

export async function rotateRefreshSession(token, request) {
  if (!token) return null
  const nextToken = newOpaqueToken()
  const nextHash = hashToken(nextToken)
  const now = new Date()
  // Atomic conditional revocation prevents two concurrent refreshes from reusing one session.
  const session = await RefreshSession.findOneAndUpdate(
    { tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, replacedByTokenHash: nextHash } },
    { new: true },
  )
  if (!session) return null

  await RefreshSession.create({
    user: session.user,
    tokenHash: nextHash,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000),
    userAgent: request.get('user-agent')?.slice(0, 500),
    ipAddress: request.ip,
  })
  return { token: nextToken, userId: session.user }
}

export async function revokeRefreshSession(token) {
  if (token) {
    await RefreshSession.updateOne(
      { tokenHash: hashToken(token), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    )
  }
}
