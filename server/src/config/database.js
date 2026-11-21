import mongoose from 'mongoose'
import { env } from './env.js'

let connectionPromise

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return mongoose.connection
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(env.MONGODB_URI, {
      appName: 'GridPulse-API',
    }).then((client) => {
      console.info('MongoDB connected')
      return client.connection
    }).catch((error) => {
      connectionPromise = undefined
      throw error
    })
  }
  return connectionPromise
}

export async function disconnectDatabase() {
  connectionPromise = undefined
  await mongoose.disconnect()
}
