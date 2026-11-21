import { AppError } from '../utils/app-error.js'

export function validate(schema, source = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source])
    if (!result.success) {
      return next(new AppError('Request validation failed.', 400, 'VALIDATION_ERROR', result.error.flatten()))
    }
    if (source === 'query') request.validatedQuery = result.data
    else request[source] = result.data
    next()
  }
}
