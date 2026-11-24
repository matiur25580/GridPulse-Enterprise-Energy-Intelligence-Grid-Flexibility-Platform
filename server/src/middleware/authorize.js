import mongoose from 'mongoose'
import { Membership } from '../models/membership.model.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'

// Resolve organization access from the authenticated user's active membership, not from the request header alone.
export const requireOrganization = asyncHandler(async (request, _response, next) => {
  const organizationId = request.params.organizationId ?? request.headers['x-organization-id']
  if (!organizationId) throw new AppError('An organization context is required.', 400, 'ORGANIZATION_REQUIRED')
  if (!mongoose.isValidObjectId(organizationId)) {
    throw new AppError('Organization identifier is invalid.', 400, 'INVALID_ORGANIZATION_ID')
  }
  const membership = await Membership.findOne({
    user: request.user.id,
    organization: organizationId,
    status: 'active',
  }).populate('organization', 'name slug status')
  if (!membership || !membership.organization || membership.organization.status !== 'active') {
    throw new AppError('You do not have access to this organization.', 403, 'ORGANIZATION_ACCESS_DENIED')
  }
  request.organization = membership.organization
  request.membership = membership
  next()
})

export const authorize = (...allowedRoles) => (request, _response, next) => {
  if (!request.membership || !allowedRoles.includes(request.membership.role)) {
    return next(new AppError('Your organization role does not permit this action.', 403, 'INSUFFICIENT_ROLE'))
  }
  next()
}
