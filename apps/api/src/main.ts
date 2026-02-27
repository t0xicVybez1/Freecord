import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { createLogger } from '@freecord/logger'

const logger = createLogger('api')

async function build() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  })

  // Plugins
  await app.register(helmet, { global: true, contentSecurityPolicy: false })
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(cookie, {
    secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    parseOptions: {},
  })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      code: 429,
      message: 'You are being rate limited.',
    }),
  })
  await app.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.CDN_MAX_FILE_SIZE || '104857600', 10),
      files: 10,
    },
  })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Register routes
  await app.register(import('./routes/auth/index.js'), { prefix: '/api/v1/auth' })
  await app.register(import('./routes/users/index.js'), { prefix: '/api/v1/users' })
  await app.register(import('./routes/guilds/index.js'), { prefix: '/api/v1/guilds' })
  await app.register(import('./routes/channels/index.js'), { prefix: '/api/v1/channels' })
  await app.register(import('./routes/invites/index.js'), { prefix: '/api/v1/invites' })
  await app.register(import('./routes/webhooks/execute.js'), { prefix: '/api/v1/webhooks' })
  await app.register(import('./routes/voice/index.js'), { prefix: '/api/v1/voice' })
  await app.register(import('./routes/internal/index.js'), { prefix: '/internal' })
  await app.register(import('./routes/admin/index.js'), { prefix: '/api/v1/admin' })

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    logger.error({ err: error, url: request.url }, 'Request error')
    if (error.statusCode) {
      reply.status(error.statusCode).send({ code: error.statusCode, message: error.message })
    } else {
      reply.status(500).send({ code: 500, message: 'Internal server error' })
    }
  })

  return app
}

async function start() {
  try {
    const app = await build()
    const port = parseInt(process.env.API_PORT || '3000', 10)
    const host = process.env.API_HOST || '0.0.0.0'

    await app.listen({ port, host })
    logger.info(`API listening on ${host}:${port}`)
  } catch (err) {
    logger.error(err, 'Failed to start API')
    process.exit(1)
  }
}

start()
