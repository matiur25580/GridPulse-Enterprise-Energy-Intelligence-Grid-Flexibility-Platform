import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import organizationRoutes from './routes/organization.routes.js'
import assetRoutes from './routes/asset.routes.js'
import analyticsRoutes from './routes/analytics.routes.js'
import intelligenceRoutes from './routes/intelligence.routes.js'
import optimizationRoutes from './routes/optimization.routes.js'
import gridFlexibilityRoutes from './routes/grid-flexibility.routes.js'
import reportRoutes from './routes/report.routes.js'
import billingRoutes from './routes/billing.routes.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'

export const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'gridpulse-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/organizations', billingRoutes)
app.use('/api/v1/organizations', reportRoutes)
app.use('/api/v1/organizations', gridFlexibilityRoutes)
app.use('/api/v1/organizations', optimizationRoutes)
app.use('/api/v1/organizations', intelligenceRoutes)
app.use('/api/v1/organizations', analyticsRoutes)
app.use('/api/v1/organizations', assetRoutes)
app.use('/api/v1/organizations', organizationRoutes)
app.use(notFoundHandler)
app.use(errorHandler)
