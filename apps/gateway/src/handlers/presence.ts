import { GatewayOpcode } from '@freecord/types'
import { createLogger } from '@freecord/logger'
import type { AuthenticatedSocket } from '../main.js'
import type { ConnectionManager } from '../lib/state.js'
import { redis } from '../lib/redis.js'

const logger = createLogger('gateway:presence')

interface PresencePayload {
  since: number | null
  activities: unknown[]
  status: string
  afk: boolean
}

export async function handlePresenceUpdate(
  ws: AuthenticatedSocket,
  d: PresencePayload,
  connManager: ConnectionManager
) {
  if (!ws.userId) return

  await redis.set(`presence:${ws.userId}`, JSON.stringify({
    status: d.status,
    activities: d.activities || [],
    clientStatus: { web: d.status },
  }))

  const presenceUpdate = {
    userId: ws.userId,
    status: d.status,
    activities: d.activities || [],
    clientStatus: { web: d.status },
  }

  // Broadcast to all guilds user is in
  for (const guildId of ws.guildIds || []) {
    connManager.sendToGuild(
      guildId,
      {
        op: GatewayOpcode.DISPATCH,
        d: { ...presenceUpdate, guildId },
        s: null,
        t: 'PRESENCE_UPDATE',
      },
      ws.userId
    )
  }
}
