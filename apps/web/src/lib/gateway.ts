import { GatewayOpcode } from '@freecord/types'

type EventHandler = (data: any) => void

export class GatewayClient {
  private ws: WebSocket | null = null
  private token: string | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private seq: number | null = null
  private sessionId: string | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private reconnectAttempts = 0
  private intentionalClose = false
  private readonly url = import.meta.env.VITE_GATEWAY_URL || 'ws://localhost:8080/gateway'

  connect(token: string) {
    this.token = token
    this.intentionalClose = false
    this.reconnectAttempts = 0
    this._connect()
  }

  private _connect() {
    if (this.ws) {
      this.ws.onclose = null // prevent old socket's close from triggering another reconnect
      this.ws.onerror = null
      this.ws.close()
    }
    this.ws = new WebSocket(this.url)
    this.ws.onopen = () => { this.reconnectAttempts = 0 }
    this.ws.onmessage = (e) => {
      try { this._handle(JSON.parse(e.data)) } catch {}
    }
    this.ws.onclose = (e) => {
      this._clearHeartbeat()
      if (!this.intentionalClose) this._scheduleReconnect()
      this._emit('__DISCONNECTED__', { code: e.code })
    }
    this.ws.onerror = () => {}
  }

  private _handle(p: { op: number; d: unknown; s: number | null; t: string | null }) {
    if (p.s !== null) this.seq = p.s
    switch (p.op) {
      case GatewayOpcode.HELLO:
        this._startHeartbeat((p.d as { heartbeatInterval: number }).heartbeatInterval)
        this._identify()
        break
      case GatewayOpcode.HEARTBEAT_ACK: break
      case GatewayOpcode.HEARTBEAT: this._sendHB(); break
      case GatewayOpcode.DISPATCH:
        if (p.t === 'READY') this.sessionId = (p.d as { sessionId: string }).sessionId
        this._emit(p.t!, p.d)
        break
      case GatewayOpcode.INVALID_SESSION:
        setTimeout(() => this._identify(), 1000)
        break
      case GatewayOpcode.RECONNECT:
        this._connect()
        break
    }
  }

  private _identify() {
    if (!this.token) return
    this._send({ op: GatewayOpcode.IDENTIFY, d: { token: this.token, properties: { os: navigator.platform, browser: 'FreeCord', device: 'web' }, presence: { status: 'online', activities: [], since: null, afk: false } } })
  }

  private _startHeartbeat(ms: number) {
    this._clearHeartbeat()
    setTimeout(() => {
      this._sendHB()
      this.heartbeatTimer = window.setInterval(() => this._sendHB(), ms)
    }, Math.random() * ms)
  }

  private _clearHeartbeat() {
    if (this.heartbeatTimer !== null) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
  }

  private _sendHB() { this._send({ op: GatewayOpcode.HEARTBEAT, d: this.seq }) }

  private _scheduleReconnect() {
    if (this.reconnectAttempts >= 5) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    this.reconnectAttempts++
    this.reconnectTimer = window.setTimeout(() => this._connect(), delay)
  }

  private _send(p: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(p))
  }

  private _emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach(h => { try { h(data) } catch {} })
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  updatePresence(status: string, activities: unknown[] = []) {
    this._send({ op: GatewayOpcode.PRESENCE_UPDATE, d: { status, activities, since: null, afk: false } })
  }

  updateVoiceState(guildId: string | null, channelId: string | null, selfMute: boolean, selfDeaf: boolean) {
    this._send({ op: GatewayOpcode.VOICE_STATE_UPDATE, d: { guildId, channelId, selfMute, selfDeaf } })
  }

  disconnect() {
    this.intentionalClose = true
    this._clearHeartbeat()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close(1000)
    this.ws = null
  }

  isConnected() { return this.ws?.readyState === WebSocket.OPEN }
}

export const gateway = new GatewayClient()
