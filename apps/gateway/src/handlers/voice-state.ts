import { GatewayOpcode } from '@freecord/types'
import { createLogger } from '@freecord/logger'
import type { AuthenticatedSocket } from '../main.js'
import type { ConnectionManager } from '../lib/state.js'

const logger = createLogger('gateway:voice')

interface VoiceStatePayload {
  guildId: string | null
  channelId: string | null
  selfMute: boolean
  selfDeaf: boolean
}

export async function handleVoiceStateUpdate(
  ws: AuthenticatedSocket,
  d: VoiceStatePayload,
  connManager: ConnectionManager
) {
  if (!ws.userId) return

  // Forward to API via HTTP to update DB
  const apiUrl = process.env.API_INTERNAL_URL || `http://localhost:${process.env.API_PORT || '3000'}`
  try {
    await fetch(`${apiUrl}/api/v1/voice/guilds/${d.guildId}/voice-states/@me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.INTERNAL_SECRET || 'internal-secret',
        'X-User-Id': ws.userId,
      },
      body: JSON.stringify({
        channelId: d.channelId,
        selfMute: d.selfMute,
        selfDeaf: d.selfDeaf,
      }),
    })
  } catch (err) {
    logger.error(err, 'Failed to update voice state')
  }
}
