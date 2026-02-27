import { GatewayOpcode } from '@freecord/types'
import type { AuthenticatedSocket } from '../main.js'

export function handleHeartbeat(ws: AuthenticatedSocket) {
  ws.isAlive = true
  ws.lastHeartbeat = Date.now()

  ws.send(
    JSON.stringify({
      op: GatewayOpcode.HEARTBEAT_ACK,
      d: null,
      s: null,
      t: null,
    })
  )
}
