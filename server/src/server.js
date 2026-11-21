import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

const app = express()
const port = Number(process.env.API_PORT ?? 4000)
const host = process.env.API_HOST ?? '0.0.0.0'
const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173'

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: allowedOrigin }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'gridpulse-api',
    environment: process.env.NODE_ENV ?? 'development',
    timestamp: new Date().toISOString(),
  })
})

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API route does not exist.',
    },
  })
})

app.listen(port, host, () => {
  console.info(`GridPulse API listening on http://${host}:${port}`)
})
