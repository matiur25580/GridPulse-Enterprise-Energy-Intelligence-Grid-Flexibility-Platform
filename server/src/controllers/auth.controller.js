import mongoose from 'mongoose'
import { User } from '../models/user.model.js'
import { Organization } from '../models/organization.model.js'
import { Membership } from '../models/membership.model.js'
import { RefreshSession } from '../models/refresh-session.model.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { env } from '../config/env.js'
import { createAccessToken, createRefreshSession, rotateRefreshSession, revokeRefreshSession } from '../services/token.service.js'

const cookieName = 'gridpulse_refresh'
const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
}

const setRefreshCookie = (response, token) => response.cookie(cookieName, token, cookieOptions)
const clearRefreshCookie = (response) => response.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined })

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email })

export const register = asyncHandler(async (request, response) => {
  const session = await mongoose.startSession()
  let createdUser
  let createdOrganization
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{
        name: request.body.name,
        email: request.body.email,
        passwordHash: request.body.password,
      }], { session })
      const slugBase = request.body.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const slug = `${slugBase}-${cryptoSlug(user.id)}`
      const [organization] = await Organization.create([{
        name: request.body.organizationName,
        slug,
        createdBy: user._id,
      }], { session })
      await Membership.create([{
        user: user._id,
        organization: organization._id,
        role: 'owner',
      }], { session })
      createdUser = user
      createdOrganization = organization
    })
  } catch (error) {
    if (error.code === 11000) throw new AppError('An account with this email already exists.', 409, 'EMAIL_ALREADY_EXISTS')
    throw error
  } finally {
    await session.endSession()
  }

  const refreshToken = await createRefreshSession(createdUser, request)
  setRefreshCookie(response, refreshToken)
  response.status(201).json({
    data: {
      user: publicUser(createdUser),
      organization: { id: createdOrganization.id, name: createdOrganization.name, slug: createdOrganization.slug, role: 'owner' },
      accessToken: createAccessToken(createdUser),
      tokenType: 'Bearer',
    },
  })
})

const cryptoSlug = (id) => id.slice(-6).toLowerCase()

export const login = asyncHandler(async (request, response) => {
  const user = await User.findOne({ email: request.body.email }).select('+passwordHash')
  if (!user || !(await user.comparePassword(request.body.password))) {
    throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS')
  }
  if (user.status !== 'active') throw new AppError('This account is unavailable.', 403, 'ACCOUNT_UNAVAILABLE')

  user.lastLoginAt = new Date()
  await user.save({ validateBeforeSave: false })
  const refreshToken = await createRefreshSession(user, request)
  setRefreshCookie(response, refreshToken)
  response.json({ data: { user: publicUser(user), accessToken: createAccessToken(user), tokenType: 'Bearer' } })
})

export const refresh = asyncHandler(async (request, response) => {
  const rotated = await rotateRefreshSession(request.cookies[cookieName], request)
  if (!rotated) {
    clearRefreshCookie(response)
    throw new AppError('Refresh session is invalid or expired. Please sign in again.', 401, 'INVALID_REFRESH_TOKEN')
  }
  const user = await User.findById(rotated.userId)
  if (!user || user.status !== 'active') {
    await RefreshSession.updateMany({ user: rotated.userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
    clearRefreshCookie(response)
    throw new AppError('This account is unavailable.', 401, 'ACCOUNT_UNAVAILABLE')
  }
  setRefreshCookie(response, rotated.token)
  response.json({ data: { user: publicUser(user), accessToken: createAccessToken(user), tokenType: 'Bearer' } })
})

export const logout = asyncHandler(async (request, response) => {
  await revokeRefreshSession(request.cookies[cookieName])
  clearRefreshCookie(response)
  response.status(204).end()
})

export const getCurrentUser = asyncHandler(async (request, response) => {
  const memberships = await Membership.find({ user: request.user.id, status: 'active' })
    .populate('organization', 'name slug status')
  response.json({
    data: {
      user: request.user,
      organizations: memberships.filter((item) => item.organization?.status === 'active').map((item) => ({
        id: item.organization.id,
        name: item.organization.name,
        slug: item.organization.slug,
        role: item.role,
      })),
    },
  })
})
