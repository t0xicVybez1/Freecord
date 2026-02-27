import * as mediasoupClient from 'mediasoup-client'

const VOICE_API = import.meta.env.VITE_VOICE_URL || 'http://localhost:8081'

async function voiceFetch(path: string, options: RequestInit = {}) {
  const r = await fetch(`${VOICE_API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  if (!r.ok) throw new Error(`Voice API error: ${r.status}`)
  if (r.status === 204) return undefined
  return r.json()
}

export class VoiceClient {
  private device: mediasoupClient.Device | null = null
  private sendTransport: mediasoupClient.types.Transport | null = null
  private recvTransport: mediasoupClient.types.Transport | null = null
  private audioProducer: mediasoupClient.types.Producer | null = null
  private videoProducer: mediasoupClient.types.Producer | null = null
  private consumers = new Map<string, mediasoupClient.types.Consumer>()
  private channelId: string | null = null
  private userId: string | null = null

  async join(channelId: string, userId: string) {
    this.channelId = channelId
    this.userId = userId

    const { rtpCapabilities } = await voiceFetch(`/voice/rooms/${channelId}/rtp-capabilities`)
    this.device = new mediasoupClient.Device()
    await this.device.load({ routerRtpCapabilities: rtpCapabilities })

    const sendParams = await voiceFetch(`/voice/rooms/${channelId}/transports`, {
      method: 'POST', body: JSON.stringify({ userId, sessionId: `${userId}-${Date.now()}` })
    })
    this.sendTransport = this.device.createSendTransport(sendParams)
    this.sendTransport.on('connect', async ({ dtlsParameters }, cb, eb) => {
      try { await voiceFetch(`/voice/rooms/${channelId}/transports/${this.sendTransport!.id}/connect`, { method: 'POST', body: JSON.stringify({ userId, dtlsParameters }) }); cb() } catch (e) { eb(e as Error) }
    })
    this.sendTransport.on('produce', async ({ kind, rtpParameters }, cb, eb) => {
      try { const { producerId } = await voiceFetch(`/voice/rooms/${channelId}/producers`, { method: 'POST', body: JSON.stringify({ userId, transportId: this.sendTransport!.id, kind, rtpParameters }) }); cb({ id: producerId }) } catch (e) { eb(e as Error) }
    })

    const recvUserId = `${userId}-recv`
    const recvParams = await voiceFetch(`/voice/rooms/${channelId}/transports`, {
      method: 'POST', body: JSON.stringify({ userId: recvUserId, sessionId: `${recvUserId}-${Date.now()}` })
    })
    this.recvTransport = this.device.createRecvTransport(recvParams)
    this.recvTransport.on('connect', async ({ dtlsParameters }, cb, eb) => {
      try { await voiceFetch(`/voice/rooms/${channelId}/transports/${this.recvTransport!.id}/connect`, { method: 'POST', body: JSON.stringify({ userId: recvUserId, dtlsParameters }) }); cb() } catch (e) { eb(e as Error) }
    })
  }

  async startAudio(): Promise<void> {
    if (!this.sendTransport || !this.device?.canProduce('audio')) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    const track = stream.getAudioTracks()[0]
    this.audioProducer = await this.sendTransport.produce({ track })
  }

  async startVideo(): Promise<MediaStream | null> {
    if (!this.sendTransport || !this.device?.canProduce('video')) return null
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, frameRate: 30 } })
    const track = stream.getVideoTracks()[0]
    this.videoProducer = await this.sendTransport.produce({ track })
    return stream
  }

  async startScreenShare(): Promise<MediaStream | null> {
    if (!this.sendTransport) return null
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    const track = stream.getVideoTracks()[0]
    this.videoProducer = await this.sendTransport.produce({ track })
    track.onended = () => this.stopVideo()
    return stream
  }

  async consumeProducer(producerId: string, kind: 'audio' | 'video'): Promise<MediaStream | null> {
    if (!this.recvTransport || !this.device || !this.channelId) return null
    const params = await voiceFetch(`/voice/rooms/${this.channelId}/consumers`, {
      method: 'POST',
      body: JSON.stringify({ userId: `${this.userId}-recv`, transportId: this.recvTransport.id, producerId, rtpCapabilities: this.device.rtpCapabilities })
    })
    const consumer = await this.recvTransport.consume(params)
    this.consumers.set(consumer.id, consumer)
    return new MediaStream([consumer.track])
  }

  async getExistingProducers(): Promise<{ userId: string; producerId: string; kind: string }[]> {
    if (!this.channelId) return []
    const { producers } = await voiceFetch(`/voice/rooms/${this.channelId}/producers?userId=${this.userId}`)
    return producers || []
  }

  muteAudio(muted: boolean) {
    if (this.audioProducer) muted ? this.audioProducer.pause() : this.audioProducer.resume()
  }

  stopVideo() { this.videoProducer?.close(); this.videoProducer = null }

  async leave() {
    this.audioProducer?.close()
    this.videoProducer?.close()
    this.consumers.forEach(c => c.close())
    this.consumers.clear()
    this.sendTransport?.close()
    this.recvTransport?.close()
    if (this.channelId && this.userId) {
      await voiceFetch(`/voice/rooms/${this.channelId}/peers/${this.userId}`, { method: 'DELETE' }).catch(() => {})
    }
    this.device = null; this.sendTransport = null; this.recvTransport = null
    this.audioProducer = null; this.videoProducer = null
    this.channelId = null; this.userId = null
  }
}

export const voiceClient = new VoiceClient()
