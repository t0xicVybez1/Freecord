import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import * as mediasoup from 'mediasoup'
import { createLogger } from '@freecord/logger'
import { RoomManager } from './lib/room.js'

const logger = createLogger('voice')

const roomManager = new RoomManager()

async function build() {
  const app = Fastify({ logger: false, trustProxy: true })

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  })

  await app.register(websocket)

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Get RTP capabilities for a room
  app.get('/voice/rooms/:channelId/rtp-capabilities', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const room = await roomManager.getOrCreateRoom(channelId)
    return reply.send({ rtpCapabilities: room.rtpCapabilities })
  })

  // Create WebRTC transport
  app.post('/voice/rooms/:channelId/transports', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { userId, sessionId } = request.body as { userId: string; sessionId: string }

    const room = await roomManager.getOrCreateRoom(channelId)

    if (!room.getPeer(userId)) {
      room.addPeer(userId, sessionId)
    }

    const transport = await room.createTransport(userId)

    return reply.send({
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    })
  })

  // Connect transport (DTLS)
  app.post('/voice/rooms/:channelId/transports/:transportId/connect', async (request, reply) => {
    const { channelId, transportId } = request.params as { channelId: string; transportId: string }
    const { userId, dtlsParameters } = request.body as { userId: string; dtlsParameters: mediasoup.types.DtlsParameters }

    const room = roomManager.getRoom(channelId)
    if (!room) return reply.status(404).send({ message: 'Room not found' })

    const peer = room.getPeer(userId)
    if (!peer) return reply.status(404).send({ message: 'Peer not found' })

    const transport = peer.transports.get(transportId)
    if (!transport) return reply.status(404).send({ message: 'Transport not found' })

    await transport.connect({ dtlsParameters })
    return reply.status(200).send({ connected: true })
  })

  // Produce (publish audio/video)
  app.post('/voice/rooms/:channelId/producers', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { userId, transportId, kind, rtpParameters } = request.body as {
      userId: string
      transportId: string
      kind: 'audio' | 'video'
      rtpParameters: unknown
    }

    const room = roomManager.getRoom(channelId)
    if (!room) return reply.status(404).send({ message: 'Room not found' })

    const producer = await room.createProducer(userId, transportId, rtpParameters as any, kind)
    return reply.send({ producerId: producer.id })
  })

  // Consume (subscribe to audio/video)
  app.post('/voice/rooms/:channelId/consumers', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { userId, transportId, producerId, rtpCapabilities } = request.body as {
      userId: string
      transportId: string
      producerId: string
      rtpCapabilities: unknown
    }

    const room = roomManager.getRoom(channelId)
    if (!room) return reply.status(404).send({ message: 'Room not found' })

    const consumer = await room.createConsumer(userId, transportId, producerId, rtpCapabilities as any)
    return reply.send({
      consumerId: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    })
  })

  // Get producers in a room (for consuming existing streams)
  app.get('/voice/rooms/:channelId/producers', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { userId } = request.query as { userId: string }

    const room = roomManager.getRoom(channelId)
    if (!room) return reply.send({ producers: [] })

    const producers = room.getProducers(userId)
    return reply.send({
      producers: producers.map((p) => ({
        userId: p.userId,
        producerId: p.producer.id,
        kind: p.producer.kind,
      })),
    })
  })

  // Leave voice room
  app.delete('/voice/rooms/:channelId/peers/:userId', async (request, reply) => {
    const { channelId, userId } = request.params as { channelId: string; userId: string }

    const room = roomManager.getRoom(channelId)
    if (room) {
      room.removePeer(userId)
      if (room.isEmpty()) {
        roomManager.removeRoom(channelId)
      }
    }

    return reply.status(204).send()
  })

  return app
}

async function start() {
  try {
    await roomManager.init()

    const app = await build()
    const port = parseInt(process.env.VOICE_PORT || '8081', 10)
    const host = process.env.VOICE_HOST || '0.0.0.0'

    await app.listen({ port, host })
    logger.info(`Voice server listening on ${host}:${port}`)

    // Cleanup empty rooms every 5 minutes
    setInterval(() => roomManager.cleanupEmptyRooms(), 5 * 60 * 1000)
  } catch (err) {
    logger.error(err, 'Failed to start voice server')
    process.exit(1)
  }
}

start()
