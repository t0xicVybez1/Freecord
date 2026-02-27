import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import sharp from 'sharp'
import { createLogger } from '@freecord/logger'
import { generateId } from '@freecord/snowflake'
import { uploadFile, downloadFile, deleteFile, ensureBucketExists } from './lib/storage.js'
import path from 'path'

const logger = createLogger('cdn')

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'image/svg+xml',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/json',
]

const MAX_FILE_SIZE = parseInt(process.env.CDN_MAX_FILE_SIZE || '104857600', 10) // 100MB

async function processImage(buffer: Buffer, contentType: string, size?: number): Promise<Buffer> {
  if (contentType === 'image/gif') return buffer // Don't process GIFs

  const img = sharp(buffer)
  const metadata = await img.metadata()

  // Resize if too large
  const maxDimension = size || 4096
  if ((metadata.width || 0) > maxDimension || (metadata.height || 0) > maxDimension) {
    img.resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
  }

  if (contentType === 'image/png') {
    return img.png({ quality: 90, compressionLevel: 6 }).toBuffer()
  }

  return img.webp({ quality: 85 }).toBuffer()
}

async function build() {
  const app = Fastify({ logger: false, trustProxy: true })

  await app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  })

  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_SIZE, files: 10 },
  })

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  // Serve file
  app.get('/*', async (request, reply) => {
    const key = (request.params as Record<string, string>)['*']
    if (!key) return reply.status(400).send({ error: 'Invalid path' })

    const file = await downloadFile(key)
    if (!file) return reply.status(404).send({ error: 'File not found' })

    // Cache headers
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    reply.header('Content-Type', file.contentType)
    return reply.send(file.body)
  })

  // Upload attachment
  app.post('/upload/attachments/:channelId', async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const parts = request.parts()
    const uploaded: {
      id: string
      filename: string
      contentType: string
      size: number
      url: string
    }[] = []

    for await (const part of parts) {
      if (part.type !== 'file') continue

      const fileBuffer = await part.toBuffer()
      const contentType = part.mimetype

      if (!ALLOWED_FILE_TYPES.includes(contentType)) {
        return reply.status(400).send({ error: `File type not allowed: ${contentType}` })
      }

      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.status(413).send({ error: 'File too large' })
      }

      const attachmentId = generateId()
      const ext = path.extname(part.filename || '') || ''
      const filename = `${part.filename || 'file'}${ext}`
      const key = `attachments/${channelId}/${attachmentId}/${filename}`

      let finalBuffer = fileBuffer
      let finalContentType = contentType

      if (ALLOWED_IMAGE_TYPES.includes(contentType) && contentType !== 'image/gif') {
        finalBuffer = await processImage(fileBuffer, contentType)
        finalContentType = 'image/webp'
      }

      await uploadFile(key, finalBuffer, finalContentType)

      const cdnBase = process.env.CDN_URL || `http://localhost:${process.env.CDN_PORT || '3001'}`
      uploaded.push({
        id: attachmentId,
        filename,
        contentType: finalContentType,
        size: finalBuffer.length,
        url: `${cdnBase}/${key}`,
      })
    }

    return reply.send({ attachments: uploaded })
  })

  // Upload avatar
  app.post('/upload/avatars/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Only images allowed for avatars' })
    }

    const buffer = await data.toBuffer()
    const processed = await processImage(buffer, data.mimetype, 512)

    const hash = generateId()
    const key = `avatars/${userId}/${hash}.webp`
    await uploadFile(key, processed, 'image/webp')

    const cdnBase = process.env.CDN_URL || `http://localhost:${process.env.CDN_PORT || '3001'}`
    return reply.send({ hash, url: `${cdnBase}/${key}` })
  })

  // Upload guild icon
  app.post('/upload/icons/:guildId', async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Only images allowed for icons' })
    }

    const buffer = await data.toBuffer()
    const processed = await processImage(buffer, data.mimetype, 512)

    const hash = generateId()
    const key = `icons/${guildId}/${hash}.webp`
    await uploadFile(key, processed, 'image/webp')

    const cdnBase = process.env.CDN_URL || `http://localhost:${process.env.CDN_PORT || '3001'}`
    return reply.send({ hash, url: `${cdnBase}/${key}` })
  })

  // Upload banner
  app.post('/upload/banners/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Only images allowed for banners' })
    }

    const buffer = await data.toBuffer()
    const processed = await processImage(buffer, data.mimetype, 1920)

    const hash = generateId()
    const key = `banners/${id}/${hash}.webp`
    await uploadFile(key, processed, 'image/webp')

    const cdnBase = process.env.CDN_URL || `http://localhost:${process.env.CDN_PORT || '3001'}`
    return reply.send({ hash, url: `${cdnBase}/${key}` })
  })

  // Upload emoji
  app.post('/upload/emojis/:guildId', async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      return reply.status(400).send({ error: 'Only images allowed for emojis' })
    }

    const buffer = await data.toBuffer()
    const emojiId = generateId()

    let processed = buffer
    let contentType = data.mimetype

    if (data.mimetype !== 'image/gif') {
      processed = await processImage(buffer, data.mimetype, 128)
      contentType = 'image/webp'
    }

    const ext = data.mimetype === 'image/gif' ? 'gif' : 'webp'
    const key = `emojis/${emojiId}.${ext}`
    await uploadFile(key, processed, contentType)

    const cdnBase = process.env.CDN_URL || `http://localhost:${process.env.CDN_PORT || '3001'}`
    return reply.send({
      id: emojiId,
      animated: data.mimetype === 'image/gif',
      url: `${cdnBase}/${key}`,
    })
  })

  // Delete file (internal only)
  app.delete('/*', async (request, reply) => {
    const internalToken = request.headers['x-internal-token']
    if (internalToken !== (process.env.INTERNAL_SECRET || 'internal-secret')) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const key = (request.params as Record<string, string>)['*']
    await deleteFile(key)
    return reply.status(204).send()
  })

  return app
}

async function start() {
  try {
    await ensureBucketExists()

    const app = await build()
    const port = parseInt(process.env.CDN_PORT || '3001', 10)
    const host = process.env.CDN_HOST || '0.0.0.0'

    await app.listen({ port, host })
    logger.info(`CDN listening on ${host}:${port}`)
  } catch (err) {
    logger.error(err, 'Failed to start CDN')
    process.exit(1)
  }
}

start()
