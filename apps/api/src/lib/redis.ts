import { Redis } from 'ioredis'
import { createLogger } from '@freecord/logger'

const logger = createLogger('redis')

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 50, 2000),
})

redis.on('connect', () => logger.info('Connected to Redis'))
redis.on('error', (err) => logger.error(err, 'Redis error'))

export async function publishEvent(event: {
  type: string
  guildId?: string | null
  channelId?: string | null
  userId?: string | null
  userIds?: string[]
  data: unknown
}) {
  await redis.publish('gateway:events', JSON.stringify(event))
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number) {
  const serialized = JSON.stringify(value)
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized)
  } else {
    await redis.set(key, serialized)
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get(key)
  if (!value) return null
  return JSON.parse(value) as T
}

export async function cacheDel(key: string) {
  await redis.del(key)
}
