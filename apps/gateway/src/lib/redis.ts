import { Redis } from 'ioredis'
import { createLogger } from '@freecord/logger'

const logger = createLogger('gateway:redis')

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

// Separate connection for subscribe (Redis subscribe requires dedicated connection)
export const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error(err, 'Redis error'))
subscriber.on('connect', () => logger.info('Redis subscriber connected'))
subscriber.on('error', (err) => logger.error(err, 'Redis subscriber error'))

export async function getUserData(userId: string) {
  const cached = await redis.get(`user:${userId}`)
  if (cached) return JSON.parse(cached)
  return null
}

export async function cacheUserData(userId: string, data: unknown) {
  await redis.setex(`user:${userId}`, 300, JSON.stringify(data))
}
