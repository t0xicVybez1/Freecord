import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { publishEvent } from '../../lib/redis.js'
import { generateId } from '@freecord/snowflake'
import { serializeMessage } from '../../lib/serialize.js'
import { z } from 'zod'

const executeSchema = z.object({
  content: z.string().max(2000).optional(),
  username: z.string().max(80).optional(),
  avatarUrl: z.string().url().optional(),
  tts: z.boolean().optional(),
  embeds: z.array(z.unknown()).max(10).optional(),
  allowedMentions: z.object({}).optional(),
})

export default async function webhookRoutes(app: FastifyInstance) {
  // Execute webhook POST /:webhookId/:token
  app.post('/:webhookId/:token', async (request, reply) => {
    const { webhookId, token } = request.params as { webhookId: string; token: string }
    const body = executeSchema.parse(request.body)

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook || webhook.token !== token) {
      return reply.status(404).send({ code: 404, message: 'Unknown webhook' })
    }

    if (!body.content && (!body.embeds || body.embeds.length === 0)) {
      return reply.status(400).send({ code: 400, message: 'Message must have content or embeds' })
    }

    const message = await prisma.message.create({
      data: {
        id: generateId(),
        channelId: webhook.channelId,
        webhookId: webhook.id,
        content: body.content || '',
        embeds: (body.embeds || []) as any,
        tts: body.tts || false,
      },
    })

    const channel = await prisma.channel.findUnique({ where: { id: webhook.channelId } })

    await prisma.channel.update({
      where: { id: webhook.channelId },
      data: { lastMessageId: message.id },
    })

    const webhookUser = {
      id: webhook.id,
      username: body.username || webhook.name,
      avatar: body.avatarUrl || webhook.avatar,
      discriminator: '0000',
      bot: true,
    }

    await publishEvent({
      type: 'MESSAGE_CREATE',
      guildId: channel?.guildId,
      channelId: webhook.channelId,
      data: {
        ...serializeMessage(message),
        author: webhookUser,
        webhookId: webhook.id,
      },
    })

    return reply.status(204).send()
  })

  // GET /:webhookId/:token - get webhook
  app.get('/:webhookId/:token', async (request, reply) => {
    const { webhookId, token } = request.params as { webhookId: string; token: string }
    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook || webhook.token !== token) {
      return reply.status(404).send({ code: 404, message: 'Unknown webhook' })
    }
    return reply.send({
      id: webhook.id,
      type: webhook.type,
      name: webhook.name,
      avatar: webhook.avatar,
      channelId: webhook.channelId,
      guildId: webhook.guildId,
    })
  })

  // PATCH /:webhookId/:token - modify webhook via token
  app.patch('/:webhookId/:token', async (request, reply) => {
    const { webhookId, token } = request.params as { webhookId: string; token: string }
    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      avatar: z.string().nullable().optional(),
    }).parse(request.body)

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook || webhook.token !== token) {
      return reply.status(404).send({ code: 404, message: 'Unknown webhook' })
    }

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
      },
    })

    return reply.send({
      id: updated.id,
      type: updated.type,
      name: updated.name,
      avatar: updated.avatar,
      channelId: updated.channelId,
      guildId: updated.guildId,
    })
  })

  // DELETE /:webhookId/:token - delete webhook via token
  app.delete('/:webhookId/:token', async (request, reply) => {
    const { webhookId, token } = request.params as { webhookId: string; token: string }

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook || webhook.token !== token) {
      return reply.status(404).send({ code: 404, message: 'Unknown webhook' })
    }

    await prisma.webhook.delete({ where: { id: webhookId } })
    return reply.status(204).send()
  })

  // GET /:webhookId - get webhook by ID (requires auth, handled via authenticate middleware when called)
  // PATCH /:webhookId - modify webhook by ID
  // DELETE /:webhookId - delete webhook by ID
  // These are auth-protected variants — clients with valid auth can manage webhooks without token

  app.get('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string }
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }

    // Quick JWT check (reuse verifyAccessToken)
    const { verifyAccessToken } = await import('../../lib/jwt.js')
    let userId: string
    try {
      const payload = verifyAccessToken(authHeader.slice(7))
      userId = payload.userId
    } catch {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook) return reply.status(404).send({ code: 404, message: 'Unknown webhook' })

    // Must be creator or guild owner
    if (webhook.userId !== userId) {
      if (webhook.guildId) {
        const guild = await prisma.guild.findUnique({ where: { id: webhook.guildId } })
        if (!guild || guild.ownerId !== userId) {
          return reply.status(403).send({ code: 403, message: 'Missing permissions' })
        }
      } else {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    return reply.send({
      id: webhook.id,
      type: webhook.type,
      name: webhook.name,
      avatar: webhook.avatar,
      channelId: webhook.channelId,
      guildId: webhook.guildId,
      token: webhook.token,
    })
  })

  app.patch('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string }
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }

    const { verifyAccessToken } = await import('../../lib/jwt.js')
    let userId: string
    try {
      const payload = verifyAccessToken(authHeader.slice(7))
      userId = payload.userId
    } catch {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook) return reply.status(404).send({ code: 404, message: 'Unknown webhook' })

    if (webhook.userId !== userId) {
      if (webhook.guildId) {
        const guild = await prisma.guild.findUnique({ where: { id: webhook.guildId } })
        if (!guild || guild.ownerId !== userId) {
          return reply.status(403).send({ code: 403, message: 'Missing permissions' })
        }
      } else {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const body = z.object({
      name: z.string().min(1).max(80).optional(),
      avatar: z.string().nullable().optional(),
      channelId: z.string().optional(),
    }).parse(request.body)

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
        ...(body.channelId !== undefined ? { channelId: body.channelId } : {}),
      },
    })

    return reply.send(updated)
  })

  app.delete('/:webhookId', async (request, reply) => {
    const { webhookId } = request.params as { webhookId: string }
    const authHeader = request.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }

    const { verifyAccessToken } = await import('../../lib/jwt.js')
    let userId: string
    try {
      const payload = verifyAccessToken(authHeader.slice(7))
      userId = payload.userId
    } catch {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }

    const webhook = await prisma.webhook.findUnique({ where: { id: webhookId } })
    if (!webhook) return reply.status(404).send({ code: 404, message: 'Unknown webhook' })

    if (webhook.userId !== userId) {
      if (webhook.guildId) {
        const guild = await prisma.guild.findUnique({ where: { id: webhook.guildId } })
        if (!guild || guild.ownerId !== userId) {
          return reply.status(403).send({ code: 403, message: 'Missing permissions' })
        }
      } else {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    await prisma.webhook.delete({ where: { id: webhookId } })
    return reply.status(204).send()
  })
}
