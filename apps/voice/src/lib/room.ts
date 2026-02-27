import * as mediasoup from 'mediasoup'
import { createLogger } from '@freecord/logger'
import { config } from './mediasoup-config.js'

const logger = createLogger('voice:room')

export interface Peer {
  userId: string
  sessionId: string
  transports: Map<string, mediasoup.types.WebRtcTransport>
  producers: Map<string, mediasoup.types.Producer>
  consumers: Map<string, mediasoup.types.Consumer>
  rtpCapabilities?: mediasoup.types.RtpCapabilities
}

export class Room {
  id: string // channelId
  private router: mediasoup.types.Router
  private peers: Map<string, Peer> = new Map() // userId -> Peer

  constructor(id: string, router: mediasoup.types.Router) {
    this.id = id
    this.router = router
  }

  get rtpCapabilities(): mediasoup.types.RtpCapabilities {
    return this.router.rtpCapabilities
  }

  addPeer(userId: string, sessionId: string): Peer {
    const peer: Peer = {
      userId,
      sessionId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    }
    this.peers.set(userId, peer)
    return peer
  }

  getPeer(userId: string): Peer | undefined {
    return this.peers.get(userId)
  }

  removePeer(userId: string) {
    const peer = this.peers.get(userId)
    if (peer) {
      // Close all transports (will close producers and consumers)
      for (const transport of peer.transports.values()) {
        transport.close()
      }
      this.peers.delete(userId)
    }
  }

  getProducers(excludeUserId?: string): { userId: string; producer: mediasoup.types.Producer }[] {
    const producers: { userId: string; producer: mediasoup.types.Producer }[] = []
    for (const [userId, peer] of this.peers) {
      if (userId === excludeUserId) continue
      for (const producer of peer.producers.values()) {
        producers.push({ userId, producer })
      }
    }
    return producers
  }

  async createTransport(userId: string): Promise<mediasoup.types.WebRtcTransport> {
    const peer = this.peers.get(userId)
    if (!peer) throw new Error('Peer not found')

    const transport = await this.router.createWebRtcTransport({
      ...config.webRtcTransport,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    })

    peer.transports.set(transport.id, transport)
    return transport
  }

  async createProducer(
    userId: string,
    transportId: string,
    rtpParameters: mediasoup.types.RtpParameters,
    kind: 'audio' | 'video'
  ): Promise<mediasoup.types.Producer> {
    const peer = this.peers.get(userId)
    if (!peer) throw new Error('Peer not found')

    const transport = peer.transports.get(transportId)
    if (!transport) throw new Error('Transport not found')

    const producer = await transport.produce({ kind, rtpParameters })
    peer.producers.set(producer.id, producer)
    return producer
  }

  async createConsumer(
    userId: string,
    transportId: string,
    producerId: string,
    rtpCapabilities: mediasoup.types.RtpCapabilities
  ): Promise<mediasoup.types.Consumer> {
    const peer = this.peers.get(userId)
    if (!peer) throw new Error('Peer not found')

    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume')
    }

    const transport = peer.transports.get(transportId)
    if (!transport) throw new Error('Transport not found')

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    })

    peer.consumers.set(consumer.id, consumer)
    return consumer
  }

  isEmpty(): boolean {
    return this.peers.size === 0
  }

  getPeerCount(): number {
    return this.peers.size
  }
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map()
  private workers: mediasoup.types.Worker[] = []
  private workerIndex = 0

  async init() {
    const os = await import('os')
    const numCpus = os.cpus().length
    const numWorkers = Math.min(numCpus, 4)

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker(config.worker)
      worker.on('died', (err) => {
        logger.error(err, `MediaSoup worker died (index ${i}). Exiting.`)
        process.exit(1)
      })
      this.workers.push(worker)
    }

    logger.info(`Created ${numWorkers} mediasoup workers`)
  }

  private getWorker(): mediasoup.types.Worker {
    const worker = this.workers[this.workerIndex % this.workers.length]
    this.workerIndex++
    return worker
  }

  async getOrCreateRoom(channelId: string): Promise<Room> {
    let room = this.rooms.get(channelId)
    if (!room) {
      const worker = this.getWorker()
      const router = await worker.createRouter({ mediaCodecs: config.router.mediaCodecs })
      room = new Room(channelId, router)
      this.rooms.set(channelId, room)
      logger.debug({ channelId }, 'Created voice room')
    }
    return room
  }

  getRoom(channelId: string): Room | undefined {
    return this.rooms.get(channelId)
  }

  removeRoom(channelId: string) {
    this.rooms.delete(channelId)
  }

  cleanupEmptyRooms() {
    for (const [channelId, room] of this.rooms) {
      if (room.isEmpty()) {
        this.rooms.delete(channelId)
        logger.debug({ channelId }, 'Removed empty voice room')
      }
    }
  }
}
