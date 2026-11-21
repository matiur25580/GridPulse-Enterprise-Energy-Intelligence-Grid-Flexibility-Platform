import { env } from '../config/env.js'
export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`)
  error.statusCode = 404
  error.code = 'NOT_FOUND'
  next(error)
}
export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode ?? (error.name === 'ValidationError' ? 400 : 500)
  const code = error.code ?? (error.name === 'ValidationError' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR')
  if (statusCode >= 500) console.error(error)
  response.status(statusCode).json({
    error: {
      code,
      message: statusCode >= 500 && env.NODE_ENV === 'production' ? 'An unexpected server error occurred.' : error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(env.NODE_ENV !== 'production' && error.name === 'ValidationError' ? { fields: error.errors } : {}),
    },
  })
}
