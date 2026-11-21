import { app } from './app.js'
import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { startAlertEvaluationWorker, stopAlertEvaluationWorker } from './workers/alert-evaluation.worker.js'
import { startAlertNotificationWorker, stopAlertNotificationWorker } from './workers/alert-notification.worker.js'

let server
async function start() {
  await connectDatabase()
  startAlertEvaluationWorker()
  startAlertNotificationWorker()
  server = app.listen(env.API_PORT, env.API_HOST, () => {
    console.info(`GridPulse API listening on http://${env.API_HOST}:${env.API_PORT}`)
  })
}
async function shutdown(signal) {
  console.info(`${signal} received; shutting down GridPulse API`)
  await stopAlertEvaluationWorker()
  await stopAlertNotificationWorker()
  if (server) await new Promise((resolve) => server.close(resolve))
  await disconnectDatabase()
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
start().catch((error) => {
  console.error('GridPulse API failed to start:', error)
  process.exit(1)
})
