import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'
import { createLogger } from '@freecord/logger'
import { GatewayOpcode } from '@freecord/types'
import { redis, subscriber } from './lib/redis.js'
import { ConnectionManager } from './lib/state.js'
import { handleIdentify } from './handlers/identify.js'
import { handleHeartbeat } from './handlers/heartbeat.js'
import { handlePresenceUpdate } from './handlers/presence.js'
import { handleVoiceStateUpdate } from './handlers/voice-state.js'
import { startSubscriber } from './subscriber.js'

const logger = createLogger('gateway')

const HEARTBEAT_INTERVAL = 41250

export interface AuthenticatedSocket extends WebSocket {
  userId?: string
  sessionId?: string
  guildIds?: Set<string>
  dmChannelIds?: Set<string>
  sequence: number
  heartbeatTimer?: NodeJS.Timeout
  lastHeartbeat?: number
  isAlive: boolean
  sessionId_?: string
}

const connManager = new ConnectionManager()
const server = createServer()
const wss = new WebSocketServer({ server, path: '/gateway' })

wss.on('connection', (ws: AuthenticatedSocket, request) => {
  ws.sequence = 0
  ws.isAlive = true
  ws.guildIds = new Set()
  ws.dmChannelIds = new Set()

  logger.debug({ ip: request.socket.remoteAddress }, 'New WebSocket connection')

  // Send HELLO
  ws.send(
    JSON.stringify({
      op: GatewayOpcode.HELLO,
      d: { heartbeatInterval: HEARTBEAT_INTERVAL },
      s: null,
      t: null,
    })
  )

  // Heartbeat timeout
  const heartbeatTimeout = setTimeout(() => {
    if (!ws.userId) {
      logger.debug('Client did not identify in time, closing')
      ws.terminate()
    }
  }, 30000)

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(data.toString())
      const { op, d } = payload

      switch (op) {
        case GatewayOpcode.IDENTIFY:
          clearTimeout(heartbeatTimeout)
          await handleIdentify(ws, d, connManager)
          break
        case GatewayOpcode.HEARTBEAT:
          handleHeartbeat(ws)
          break
        case GatewayOpcode.PRESENCE_UPDATE:
          await handlePresenceUpdate(ws, d, connManager)
          break
        case GatewayOpcode.VOICE_STATE_UPDATE:
          await handleVoiceStateUpdate(ws, d, connManager)
          break
        case GatewayOpcode.RESUME:
          // Simplified resume: just re-identify
          ws.send(JSON.stringify({ op: GatewayOpcode.INVALID_SESSION, d: false, s: null, t: null }))
          break
        default:
          logger.debug({ op }, 'Unknown opcode')
      }
    } catch (err) {
      logger.error(err, 'Error processing message')
    }
  })

  ws.on('close', () => {
    if (ws.userId) {
      connManager.remove(ws.userId, ws)
      logger.debug({ userId: ws.userId }, 'Client disconnected')
    }
    clearTimeout(heartbeatTimeout)
    if (ws.heartbeatTimer) clearInterval(ws.heartbeatTimer)
  })

  ws.on('error', (err) => {
    logger.error(err, 'WebSocket error')
  })
})

// Start Redis subscriber
startSubscriber(connManager)

const port = parseInt(process.env.GATEWAY_PORT || '8080', 10)
const host = process.env.GATEWAY_HOST || '0.0.0.0'

server.listen(port, host, () => {
  logger.info(`Gateway listening on ${host}:${port}`)
})

// Ping clients every 30s
setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as AuthenticatedSocket
    if (!client.isAlive) {
      client.terminate()
      return
    }
    client.isAlive = false
    client.ping()
  })
}, 30000)

export { connManager }
