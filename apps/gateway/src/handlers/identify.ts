import jwt from 'jsonwebtoken'
import { GatewayOpcode } from '@freecord/types'
import { createLogger } from '@freecord/logger'
import type { AuthenticatedSocket } from '../main.js'
import type { ConnectionManager } from '../lib/state.js'
import { redis } from '../lib/redis.js'

const logger = createLogger('gateway:identify')
const ACCESS_SECRET = process.env.JWT_SECRET || 'access-secret'

interface IdentifyPayload {
  token: string
  properties?: { os?: string; browser?: string; device?: string }
  presence?: { status?: string; activities?: unknown[] }
}

export async function handleIdentify(
  ws: AuthenticatedSocket,
  d: IdentifyPayload,
  connManager: ConnectionManager
) {
  try {
    const payload = jwt.verify(d.token, ACCESS_SECRET) as { userId: string; sessionId: string }

    ws.userId = payload.userId
    ws.sessionId = payload.sessionId

    // Get user data + guilds + DMs from API (or Redis cache)
    // In production, we'd query the DB here. For now, get from Redis cache or fetch from API
    const userData = await fetchUserData(payload.userId)

    if (!userData) {
      ws.send(
        JSON.stringify({
          op: GatewayOpcode.INVALID_SESSION,
          d: false,
          s: null,
          t: null,
        })
      )
      ws.close()
      return
    }

    connManager.add(payload.userId, ws)

    // Subscribe to user's guilds and DM channels
    for (const guild of userData.guilds || []) {
      connManager.subscribeToGuild(payload.userId, guild.id)
      ws.guildIds!.add(guild.id)
    }

    for (const channel of userData.dmChannels || []) {
      connManager.subscribeToChannel(payload.userId, channel.id)
      ws.dmChannelIds!.add(channel.id)
    }

    // Set up heartbeat
    ws.heartbeatTimer = setInterval(() => {
      if (!ws.isAlive) {
        ws.terminate()
        return
      }
    }, 41250)

    ws.isAlive = true

    // Update presence to online
    await redis.set(`presence:${payload.userId}`, JSON.stringify({
      status: d.presence?.status || 'online',
      activities: d.presence?.activities || [],
      clientStatus: { web: d.presence?.status || 'online' },
    }))

    const sessionId = `${payload.userId}-${Date.now()}`

    // Send READY
    ws.send(
      JSON.stringify({
        op: GatewayOpcode.DISPATCH,
        d: {
          v: 10,
          user: userData.user,
          guilds: userData.guilds,
          sessionId,
          resumeGatewayUrl: `ws://${process.env.GATEWAY_HOST || 'localhost'}:${process.env.GATEWAY_PORT || '8080'}/gateway`,
          readState: userData.readStates || [],
          relationships: userData.relationships || [],
          privateChannels: userData.dmChannels || [],
          presences: [],
          userSettings: userData.userSettings || {},
        },
        s: ++ws.sequence,
        t: 'READY',
      })
    )

    // Broadcast PRESENCE_UPDATE to guilds user is in
    for (const guildId of ws.guildIds!) {
      connManager.sendToGuild(
        guildId,
        {
          op: GatewayOpcode.DISPATCH,
          d: {
            userId: payload.userId,
            guildId,
            status: d.presence?.status || 'online',
            activities: d.presence?.activities || [],
            clientStatus: { web: d.presence?.status || 'online' },
          },
          s: null,
          t: 'PRESENCE_UPDATE',
        },
        payload.userId
      )
    }

    logger.debug({ userId: payload.userId }, 'Client identified')
  } catch (err) {
    logger.error(err, 'Identify failed')
    ws.send(
      JSON.stringify({
        op: GatewayOpcode.INVALID_SESSION,
        d: false,
        s: null,
        t: null,
      })
    )
    ws.close()
  }
}

async function fetchUserData(userId: string) {
  try {
    const apiUrl = process.env.API_INTERNAL_URL || `http://localhost:${process.env.API_PORT || '3000'}`
    const resp = await fetch(`${apiUrl}/internal/users/@me/ready`, {
      headers: { 'X-Internal-Token': process.env.INTERNAL_TOKEN || 'internal-secret', 'X-User-Id': userId },
    })
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}
