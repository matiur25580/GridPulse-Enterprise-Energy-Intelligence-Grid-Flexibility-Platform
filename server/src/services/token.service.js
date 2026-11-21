import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { RefreshSession } from '../models/refresh-session.model.js'

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

export function createAccessToken(user) {
  return jwt.sign({ email: user.email }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    issuer: 'gridpulse-api',
    audience: 'gridpulse-client',
    expiresIn: env.ACCESS_TOKEN_TTL,
  })
}

export async function createRefreshSession(user, request) {
  const token = crypto.randomBytes(48).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  await RefreshSession.create({
    user: user._id,
    tokenHash,
    expiresAt,
    userAgent: request.get('user-agent')?.slice(0, 500),
    ipAddress: request.ip,
  })
  return token
}

export async function rotateRefreshSession(token, request) {
  if (!token) return null
  const tokenHash = hashToken(token)
  const session = await RefreshSession.findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } })
  if (!session) return null

  session.revokedAt = new Date()
  const nextToken = crypto.randomBytes(48).toString('base64url')
  const nextHash = hashToken(nextToken)
  session.replacedByTokenHash = nextHash
  await session.save()
  await RefreshSession.create({
    user: session.user,
    tokenHash: nextHash,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    userAgent: request.get('user-agent')?.slice(0, 500),
    ipAddress: request.ip,
  })
  return { token: nextToken, userId: session.user }
}

export async function revokeRefreshSession(token) {
  if (!token) return
  await RefreshSession.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } })
}
