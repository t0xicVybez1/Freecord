import { GatewayOpcode } from '@freecord/types'
import { createLogger } from '@freecord/logger'
import { subscriber } from './lib/redis.js'
import type { ConnectionManager } from './lib/state.js'

const logger = createLogger('gateway:subscriber')

interface GatewayEvent {
  type: string
  guildId?: string | null
  channelId?: string | null
  userId?: string | null
  userIds?: string[]
  data: unknown
}

export function startSubscriber(connManager: ConnectionManager) {
  subscriber.subscribe('gateway:events', (err) => {
    if (err) {
      logger.error(err, 'Failed to subscribe to gateway:events')
      return
    }
    logger.info('Subscribed to gateway:events')
  })

  subscriber.on('message', (channel, message) => {
    if (channel !== 'gateway:events') return

    try {
      const event: GatewayEvent = JSON.parse(message)
      dispatchEvent(event, connManager)
    } catch (err) {
      logger.error(err, 'Failed to parse gateway event')
    }
  })
}

function dispatchEvent(event: GatewayEvent, connManager: ConnectionManager) {
  const payload = {
    op: GatewayOpcode.DISPATCH,
    d: event.data,
    s: null,
    t: event.type,
  }

  // User-specific events (sent only to a specific user or list of users)
  if (event.userIds && event.userIds.length > 0) {
    connManager.sendToUsers(event.userIds, payload)
    return
  }

  if (event.userId && !event.guildId && !event.channelId) {
    connManager.sendToUser(event.userId, payload)
    return
  }

  // When a new member joins a guild, subscribe their live connection to that guild's events
  if (event.type === 'GUILD_MEMBER_ADD' && event.guildId) {
    const userId = (event.data as any)?.user?.id
    if (userId) {
      connManager.subscribeToGuild(userId, event.guildId)
    }
  }

  // Guild events — fan out to all guild members online
  if (event.guildId) {
    connManager.sendToGuild(event.guildId, payload)
  }

  // Also send to channel subscribers (for DM channels)
  if (event.channelId && !event.guildId) {
    connManager.sendToChannel(event.channelId, payload)
  }

  // Voice server update goes to specific user
  if (event.type === 'VOICE_SERVER_UPDATE' && event.userId) {
    connManager.sendToUser(event.userId, payload)
  }
}
