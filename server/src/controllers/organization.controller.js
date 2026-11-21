import { Organization } from '../models/organization.model.js'
import { Membership } from '../models/membership.model.js'
import { asyncHandler } from '../utils/async-handler.js'
import { AppError } from '../utils/app-error.js'

export const listOrganizations = asyncHandler(async (request, response) => {
  const memberships = await Membership.find({ user: request.user.id, status: 'active' })
    .populate({ path: 'organization', match: { status: 'active' }, select: 'name slug status createdAt' })
  response.json({
    data: memberships.filter((item) => item.organization).map((item) => ({
      id: item.organization.id,
      name: item.organization.name,
      slug: item.organization.slug,
      role: item.role,
      joinedAt: item.createdAt,
    })),
  })
})

export const getOrganization = asyncHandler(async (request, response) => {
  const organization = await Organization.findById(request.organization.id).select('name slug status createdAt updatedAt')
  if (!organization) throw new AppError('Organization not found.', 404, 'ORGANIZATION_NOT_FOUND')
  response.json({ data: { ...organization.toJSON(), role: request.membership.role } })
})
