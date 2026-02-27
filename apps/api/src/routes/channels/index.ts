import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { prisma } from '../../lib/prisma.js'
import { publishEvent } from '../../lib/redis.js'
import { generateId } from '@freecord/snowflake'
import { generateRandomString } from '../../lib/hash.js'
import { serializeMessage, serializeChannel } from '../../lib/serialize.js'

const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  topic: z.string().max(1024).nullable().optional(),
  position: z.number().optional(),
  parentId: z.string().nullable().optional(),
  nsfw: z.boolean().optional(),
  slowmode: z.number().min(0).max(21600).optional(),
  bitrate: z.number().optional(),
  userLimit: z.number().optional(),
  rtcRegion: z.string().nullable().optional(),
  permissionOverwrites: z.array(z.unknown()).optional(),
})

const createMessageSchema = z.object({
  content: z.string().max(2000).optional(),
  tts: z.boolean().optional(),
  embeds: z.array(z.unknown()).max(10).optional(),
  allowedMentions: z.object({}).optional(),
  messageReference: z.object({ messageId: z.string(), channelId: z.string().optional(), guildId: z.string().optional() }).optional(),
  components: z.array(z.unknown()).optional(),
  stickerIds: z.array(z.string()).optional(),
  flags: z.number().optional(),
})

async function canAccessChannel(channelId: string, userId: string): Promise<boolean> {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) return false

  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    const membership = await prisma.directMessageMember.findFirst({
      where: { channelId, userId },
    })
    return !!membership
  }

  if (channel.guildId) {
    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: channel.guildId, userId } },
    })
    return !!member
  }

  return false
}

export default async function channelRoutes(app: FastifyInstance) {
  // GET /channels/:channelId
  app.get('/:channelId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        dmMembers: {
          include: { user: true },
        },
      },
    })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    return reply.send(serializeChannel(channel))
  })

  // PATCH /channels/:channelId
  app.patch('/:channelId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const body = updateChannelSchema.parse(request.body)

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    // Permission check
    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

      const member = await prisma.guildMember.findUnique({
        where: { guildId_userId: { guildId: channel.guildId, userId: request.userId } },
      })
      if (!member || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.topic !== undefined) updateData.topic = body.topic
    if (body.position !== undefined) updateData.position = body.position
    if (body.parentId !== undefined) updateData.parentId = body.parentId
    if (body.nsfw !== undefined) updateData.nsfw = body.nsfw
    if (body.slowmode !== undefined) updateData.slowmode = body.slowmode
    if (body.bitrate !== undefined) updateData.bitrate = body.bitrate
    if (body.userLimit !== undefined) updateData.userLimit = body.userLimit
    if (body.rtcRegion !== undefined) updateData.rtcRegion = body.rtcRegion
    if (body.permissionOverwrites !== undefined) updateData.permissionOverwrites = body.permissionOverwrites

    const updated = await prisma.channel.update({ where: { id: channelId }, data: updateData })
    const serialized = serializeChannel(updated)

    await publishEvent({
      type: 'CHANNEL_UPDATE',
      guildId: channel.guildId,
      data: serialized,
    })

    return reply.send(serialized)
  })

  // DELETE /channels/:channelId
  app.delete('/:channelId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    } else {
      // DM: just remove self from DM
      await prisma.directMessageMember.deleteMany({
        where: { channelId, userId: request.userId },
      })
      return reply.status(200).send(serializeChannel(channel))
    }

    await prisma.channel.delete({ where: { id: channelId } })

    await publishEvent({
      type: 'CHANNEL_DELETE',
      guildId: channel.guildId,
      data: serializeChannel(channel),
    })

    return reply.send(serializeChannel(channel))
  })

  // GET /channels/:channelId/messages
  app.get('/:channelId/messages', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { limit = 50, before, after, around } = request.query as {
      limit?: number; before?: string; after?: string; around?: string
    }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const take = Math.min(Number(limit), 100)

    let whereClause: Record<string, unknown> = { channelId, deletedAt: null }
    let orderBy: Record<string, string> = { createdAt: 'desc' }

    if (before) {
      whereClause = { ...whereClause, id: { lt: before } }
    } else if (after) {
      whereClause = { ...whereClause, id: { gt: after } }
      orderBy = { createdAt: 'asc' }
    } else if (around) {
      // Fetch messages around a given ID
      const aroundMsg = await prisma.message.findUnique({ where: { id: around } })
      if (aroundMsg) {
        const half = Math.floor(take / 2)
        const [before_msgs, after_msgs] = await Promise.all([
          prisma.message.findMany({
            where: { channelId, deletedAt: null, createdAt: { lte: aroundMsg.createdAt } },
            orderBy: { createdAt: 'desc' },
            take: half + 1,
            include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
          }),
          prisma.message.findMany({
            where: { channelId, deletedAt: null, createdAt: { gt: aroundMsg.createdAt } },
            orderBy: { createdAt: 'asc' },
            take: half,
            include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
          }),
        ])
        const combined = [...before_msgs.reverse(), ...after_msgs]
        return reply.send(combined.map((m) => serializeMessage(m, request.userId)))
      }
    }

    const messages = await prisma.message.findMany({
      where: whereClause,
      orderBy,
      take,
      include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
    })

    const result = orderBy.createdAt === 'desc' ? messages.reverse() : messages
    return reply.send(result.map((m) => serializeMessage(m, request.userId)))
  })

  // GET /channels/:channelId/messages/search?q=...
  app.get('/:channelId/messages/search', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { q = '', limit = 25 } = request.query as { q?: string; limit?: number }

    if (!q.trim()) return reply.send({ messages: [], total: 0 })

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const take = Math.min(Number(limit), 100)
    const messages = await prisma.message.findMany({
      where: {
        channelId,
        deletedAt: null,
        content: { contains: q.trim(), mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
    })

    return reply.send({ messages: messages.map((m) => serializeMessage(m, request.userId)), total: messages.length })
  })

  // POST /channels/:channelId/messages
  app.post('/:channelId/messages', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const body = createMessageSchema.parse(request.body)

    if (!body.content && (!body.embeds || body.embeds.length === 0)) {
      return reply.status(400).send({ code: 400, message: 'Message must have content or embeds' })
    }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    // Parse mentions from content
    const content = body.content || ''
    const userMentions = [...content.matchAll(/<@!?(\d+)>/g)].map((m) => m[1])
    const roleMentions = [...content.matchAll(/<@&(\d+)>/g)].map((m) => m[1])
    const channelMentions = [...content.matchAll(/<#(\d+)>/g)].map((m) => m[1])
    const mentionEveryone = /@everyone|@here/.test(content)

    // Handle replies
    let messageType: string = 'DEFAULT'
    if (body.messageReference?.messageId) {
      messageType = 'REPLY'
    }

    const message = await prisma.message.create({
      data: {
        id: generateId(),
        channelId,
        authorId: request.userId,
        content,
        type: messageType as any,
        tts: body.tts ?? false,
        embeds: body.embeds ?? [],
        mentionEveryone,
        mentions: userMentions,
        mentionRoles: roleMentions,
        mentionChannels: channelMentions,
        flags: body.flags ?? 0,
        referencedMessageId: body.messageReference?.messageId,
      },
      include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
    })

    // Update lastMessageId
    await prisma.channel.update({
      where: { id: channelId },
      data: { lastMessageId: message.id },
    })

    const serialized = serializeMessage(message, request.userId)

    await publishEvent({
      type: 'MESSAGE_CREATE',
      guildId: channel.guildId,
      channelId,
      data: serialized,
    })

    return reply.status(201).send(serialized)
  })

  // GET /channels/:channelId/messages/:messageId
  app.get('/:channelId/messages/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId } = request.params as { channelId: string; messageId: string }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
      include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
    })
    if (!message) return reply.status(404).send({ code: 404, message: 'Unknown message' })

    return reply.send(serializeMessage(message, request.userId))
  })

  // PATCH /channels/:channelId/messages/:messageId
  app.patch('/:channelId/messages/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId } = request.params as { channelId: string; messageId: string }
    const { content, embeds, flags } = z.object({
      content: z.string().max(2000).optional(),
      embeds: z.array(z.unknown()).max(10).optional(),
      flags: z.number().optional(),
    }).parse(request.body)

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
      include: { author: true },
    })
    if (!message) return reply.status(404).send({ code: 404, message: 'Unknown message' })

    // Only author can edit
    if (message.authorId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Cannot edit messages from other users' })
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: {
        content: content ?? message.content,
        embeds: embeds ?? message.embeds,
        flags: flags ?? message.flags,
        editedAt: new Date(),
      },
      include: { author: true, reactions: true, referencedMessage: { include: { author: true } } },
    })

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    const serialized = serializeMessage(updated, request.userId)

    await publishEvent({
      type: 'MESSAGE_UPDATE',
      guildId: channel?.guildId,
      channelId,
      data: serialized,
    })

    return reply.send(serialized)
  })

  // DELETE /channels/:channelId/messages/:messageId
  app.delete('/:channelId/messages/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId } = request.params as { channelId: string; messageId: string }

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
    })
    if (!message) return reply.status(404).send({ code: 404, message: 'Unknown message' })

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })

    // Must be author or have MANAGE_MESSAGES
    const isAuthor = message.authorId === request.userId
    let canManage = false

    if (channel?.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      canManage = guild?.ownerId === request.userId
    }

    if (!isAuthor && !canManage) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    })

    await publishEvent({
      type: 'MESSAGE_DELETE',
      guildId: channel?.guildId,
      channelId,
      data: { id: messageId, channelId, guildId: channel?.guildId },
    })

    return reply.status(204).send()
  })

  // POST /channels/:channelId/messages/bulk-delete
  app.post('/:channelId/messages/bulk-delete', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { messages: messageIds } = z.object({
      messages: z.array(z.string()).min(2).max(100),
    }).parse(request.body)

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    // Only messages younger than 2 weeks
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        channelId,
        deletedAt: null,
        createdAt: { gte: twoWeeksAgo },
      },
      data: { deletedAt: new Date() },
    })

    await publishEvent({
      type: 'MESSAGE_DELETE_BULK',
      guildId: channel.guildId,
      channelId,
      data: { ids: messageIds, channelId, guildId: channel.guildId },
    })

    return reply.status(204).send()
  })

  // PUT /channels/:channelId/messages/:messageId/reactions/:emoji/@me - add reaction
  app.put('/:channelId/messages/:messageId/reactions/:emoji/@me', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId, emoji } = request.params as {
      channelId: string; messageId: string; emoji: string
    }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
    })
    if (!message) return reply.status(404).send({ code: 404, message: 'Unknown message' })

    const decodedEmoji = decodeURIComponent(emoji)

    // Check if already reacted
    const existing = await prisma.messageReaction.findFirst({
      where: { messageId, userId: request.userId, emoji: decodedEmoji },
    })
    if (existing) return reply.status(204).send()

    await prisma.messageReaction.create({
      data: {
        id: generateId(),
        messageId,
        userId: request.userId,
        emoji: decodedEmoji,
        emojiName: decodedEmoji,
      },
    })

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })

    await publishEvent({
      type: 'MESSAGE_REACTION_ADD',
      guildId: channel?.guildId,
      channelId,
      data: {
        userId: request.userId,
        channelId,
        messageId,
        guildId: channel?.guildId,
        emoji: { id: null, name: decodedEmoji, animated: false },
      },
    })

    return reply.status(204).send()
  })

  // DELETE /channels/:channelId/messages/:messageId/reactions/:emoji/@me - remove own reaction
  app.delete('/:channelId/messages/:messageId/reactions/:emoji/@me', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId, emoji } = request.params as {
      channelId: string; messageId: string; emoji: string
    }

    const decodedEmoji = decodeURIComponent(emoji)

    const reaction = await prisma.messageReaction.findFirst({
      where: { messageId, userId: request.userId, emoji: decodedEmoji },
    })
    if (!reaction) return reply.status(404).send({ code: 404, message: 'Unknown reaction' })

    await prisma.messageReaction.delete({ where: { id: reaction.id } })

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })

    await publishEvent({
      type: 'MESSAGE_REACTION_REMOVE',
      guildId: channel?.guildId,
      channelId,
      data: {
        userId: request.userId,
        channelId,
        messageId,
        guildId: channel?.guildId,
        emoji: { id: null, name: decodedEmoji, animated: false },
      },
    })

    return reply.status(204).send()
  })

  // DELETE /channels/:channelId/messages/:messageId/reactions/:emoji/:userId - remove user reaction
  app.delete('/:channelId/messages/:messageId/reactions/:emoji/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId, emoji, userId } = request.params as {
      channelId: string; messageId: string; emoji: string; userId: string
    }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    // Need MANAGE_MESSAGES
    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const decodedEmoji = decodeURIComponent(emoji)
    const reaction = await prisma.messageReaction.findFirst({
      where: { messageId, userId, emoji: decodedEmoji },
    })
    if (!reaction) return reply.status(404).send({ code: 404, message: 'Unknown reaction' })

    await prisma.messageReaction.delete({ where: { id: reaction.id } })

    await publishEvent({
      type: 'MESSAGE_REACTION_REMOVE',
      guildId: channel?.guildId,
      channelId,
      data: {
        userId,
        channelId,
        messageId,
        guildId: channel?.guildId,
        emoji: { id: null, name: decodedEmoji, animated: false },
      },
    })

    return reply.status(204).send()
  })

  // DELETE /channels/:channelId/messages/:messageId/reactions - clear all reactions
  app.delete('/:channelId/messages/:messageId/reactions', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId } = request.params as { channelId: string; messageId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    await prisma.messageReaction.deleteMany({ where: { messageId } })

    await publishEvent({
      type: 'MESSAGE_REACTION_REMOVE_ALL',
      guildId: channel?.guildId,
      channelId,
      data: { channelId, messageId, guildId: channel?.guildId },
    })

    return reply.status(204).send()
  })

  // GET /channels/:channelId/messages/:messageId/reactions/:emoji - get users who reacted
  app.get('/:channelId/messages/:messageId/reactions/:emoji', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId, emoji } = request.params as {
      channelId: string; messageId: string; emoji: string
    }
    const { limit = 25, after } = request.query as { limit?: number; after?: string }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const decodedEmoji = decodeURIComponent(emoji)

    const reactions = await prisma.messageReaction.findMany({
      where: {
        messageId,
        emoji: decodedEmoji,
        ...(after ? { userId: { gt: after } } : {}),
      },
      take: Math.min(Number(limit), 100),
      include: { user: true },
    })

    return reply.send(reactions.map((r) => ({
      id: r.user.id,
      username: r.user.username,
      discriminator: r.user.discriminator,
      avatar: r.user.avatar,
    })))
  })

  // GET /channels/:channelId/pins
  app.get('/:channelId/pins', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const pins = await prisma.messagePin.findMany({
      where: { channelId },
      orderBy: { pinnedAt: 'desc' },
      include: {
        message: { include: { author: true, reactions: true } },
      },
    })

    return reply.send(pins.map((p) => serializeMessage(p.message, request.userId)))
  })

  // PUT /channels/:channelId/pins/:messageId
  app.put('/:channelId/pins/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId } = request.params as { channelId: string; messageId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const message = await prisma.message.findFirst({
      where: { id: messageId, channelId, deletedAt: null },
    })
    if (!message) return reply.status(404).send({ code: 404, message: 'Unknown message' })

    // Check pin count (max 50)
    const pinCount = await prisma.messagePin.count({ where: { channelId } })
    if (pinCount >= 50) {
      return reply.status(400).send({ code: 400, message: 'Maximum number of pins reached (50)' })
    }

    await prisma.messagePin.upsert({
      where: { channelId_messageId: { channelId, messageId } },
      create: { id: generateId(), channelId, messageId, pinnedBy: request.userId },
      update: {},
    })

    await prisma.message.update({ where: { id: messageId }, data: { pinned: true } })
    await prisma.channel.update({ where: { id: channelId }, data: { lastPinTimestamp: new Date() } })

    await publishEvent({
      type: 'CHANNEL_PINS_UPDATE',
      guildId: channel.guildId,
      channelId,
      data: { channelId, guildId: channel.guildId, lastPinTimestamp: new Date().toISOString() },
    })

    return reply.status(204).send()
  })

  // DELETE /channels/:channelId/pins/:messageId
  app.delete('/:channelId/pins/:messageId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, messageId } = request.params as { channelId: string; messageId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const pin = await prisma.messagePin.findUnique({
      where: { channelId_messageId: { channelId, messageId } },
    })
    if (!pin) return reply.status(404).send({ code: 404, message: 'Message not pinned' })

    await prisma.messagePin.delete({ where: { id: pin.id } })
    await prisma.message.update({ where: { id: messageId }, data: { pinned: false } })

    await publishEvent({
      type: 'CHANNEL_PINS_UPDATE',
      guildId: channel.guildId,
      channelId,
      data: { channelId, guildId: channel.guildId, lastPinTimestamp: new Date().toISOString() },
    })

    return reply.status(204).send()
  })

  // POST /channels/:channelId/typing - send typing indicator
  app.post('/:channelId/typing', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })

    await publishEvent({
      type: 'TYPING_START',
      guildId: channel?.guildId,
      channelId,
      data: {
        channelId,
        guildId: channel?.guildId,
        userId: request.userId,
        timestamp: Math.floor(Date.now() / 1000),
      },
    })

    return reply.status(204).send()
  })

  // POST /channels/:channelId/threads - create thread
  app.post('/:channelId/threads', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { name, autoArchiveDuration, type, invitable, messageId } = z.object({
      name: z.string().min(1).max(100),
      autoArchiveDuration: z.number().optional(),
      type: z.number().optional(),
      invitable: z.boolean().optional(),
      messageId: z.string().optional(),
    }).parse(request.body)

    const parentChannel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!parentChannel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    const member = parentChannel.guildId
      ? await prisma.guildMember.findUnique({
          where: { guildId_userId: { guildId: parentChannel.guildId!, userId: request.userId } },
        })
      : null

    if (parentChannel.guildId && !member) {
      return reply.status(403).send({ code: 403, message: 'Missing access' })
    }

    const threadType = type === 11 ? 'PUBLIC_THREAD' : 'PRIVATE_THREAD'

    const thread = await prisma.channel.create({
      data: {
        id: generateId(),
        type: threadType as any,
        guildId: parentChannel.guildId,
        name,
        parentId: channelId,
        ownerId: request.userId,
        threadMetadata: {
          archived: false,
          autoArchiveDuration: autoArchiveDuration ?? 1440,
          archiveTimestamp: null,
          locked: false,
          invitable: invitable ?? true,
          createTimestamp: new Date().toISOString(),
        },
        messageCount: 0,
        memberCount: 1,
      },
    })

    const serialized = serializeChannel(thread)

    await publishEvent({
      type: 'THREAD_CREATE',
      guildId: parentChannel.guildId,
      data: serialized,
    })

    return reply.status(201).send(serialized)
  })

  // GET /channels/:channelId/threads/active
  app.get('/:channelId/threads/active', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const canAccess = await canAccessChannel(channelId, request.userId)
    if (!canAccess) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const threads = await prisma.channel.findMany({
      where: {
        parentId: channelId,
        type: { in: ['PUBLIC_THREAD', 'PRIVATE_THREAD'] },
      },
    })

    return reply.send({ threads: threads.map(serializeChannel), hasMore: false })
  })

  // POST /channels/:channelId/webhooks - create webhook
  app.post('/:channelId/webhooks', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { name, avatar } = z.object({
      name: z.string().min(1).max(80),
      avatar: z.string().optional(),
    }).parse(request.body)

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const webhook = await prisma.webhook.create({
      data: {
        id: generateId(),
        guildId: channel.guildId,
        channelId,
        userId: request.userId,
        name,
        avatar,
        token: generateRandomString(64),
      },
    })

    return reply.status(201).send(webhook)
  })

  // GET /channels/:channelId/webhooks
  app.get('/:channelId/webhooks', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const webhooks = await prisma.webhook.findMany({ where: { channelId } })
    return reply.send(webhooks)
  })

  // PATCH /channels/:channelId/permissions/:overwriteId
  app.patch('/:channelId/permissions/:overwriteId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, overwriteId } = request.params as { channelId: string; overwriteId: string }
    const { allow, deny, type } = z.object({
      allow: z.string().optional(),
      deny: z.string().optional(),
      type: z.number(),
    }).parse(request.body)

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const overwrites = (channel.permissionOverwrites as any[]) || []
    const idx = overwrites.findIndex((o: any) => o.id === overwriteId)
    const newOverwrite = { id: overwriteId, type, allow: allow ?? '0', deny: deny ?? '0' }

    if (idx >= 0) {
      overwrites[idx] = newOverwrite
    } else {
      overwrites.push(newOverwrite)
    }

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: { permissionOverwrites: overwrites },
    })

    await publishEvent({
      type: 'CHANNEL_UPDATE',
      guildId: channel.guildId,
      data: serializeChannel(updated),
    })

    return reply.status(204).send()
  })

  // DELETE /channels/:channelId/permissions/:overwriteId
  app.delete('/:channelId/permissions/:overwriteId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, overwriteId } = request.params as { channelId: string; overwriteId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })
      if (!guild || guild.ownerId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    const overwrites = ((channel.permissionOverwrites as any[]) || []).filter(
      (o: any) => o.id !== overwriteId
    )

    const updated = await prisma.channel.update({
      where: { id: channelId },
      data: { permissionOverwrites: overwrites },
    })

    await publishEvent({
      type: 'CHANNEL_UPDATE',
      guildId: channel.guildId,
      data: serializeChannel(updated),
    })

    return reply.status(204).send()
  })

  // POST /channels/:channelId/invites - create invite
  app.post('/:channelId/invites', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { maxAge = 86400, maxUses = 0, temporary = false, unique = false } = z.object({
      maxAge: z.number().min(0).max(604800).optional(),
      maxUses: z.number().min(0).max(100).optional(),
      temporary: z.boolean().optional(),
      unique: z.boolean().optional(),
    }).parse(request.body || {})

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })
    if (!channel.guildId) return reply.status(400).send({ code: 400, message: 'Cannot create invite for DM channel' })

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: channel.guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing permissions' })

    // Generate unique invite code
    const code = generateRandomString(8)
    const expiresAt = maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : null

    const invite = await prisma.guildInvite.create({
      data: {
        code,
        guildId: channel.guildId,
        channelId,
        inviterId: request.userId,
        maxAge,
        maxUses,
        temporary,
        expiresAt,
      },
    })

    const inviter = await prisma.user.findUnique({ where: { id: request.userId } })
    const guild = await prisma.guild.findUnique({ where: { id: channel.guildId } })

    return reply.status(201).send({
      code: invite.code,
      guild: guild ? { id: guild.id, name: guild.name, icon: guild.icon } : null,
      channel: { id: channel.id, name: channel.name, type: 0 },
      inviter: inviter ? { id: inviter.id, username: inviter.username, avatar: inviter.avatar } : null,
      uses: invite.uses,
      maxUses: invite.maxUses,
      maxAge: invite.maxAge,
      temporary: invite.temporary,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    })
  })

  // GET /channels/:channelId/invites
  app.get('/:channelId/invites', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    if (channel.guildId) {
      const member = await prisma.guildMember.findUnique({
        where: { guildId_userId: { guildId: channel.guildId, userId: request.userId } },
      })
      if (!member) return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const invites = await prisma.guildInvite.findMany({ where: { channelId } })
    return reply.send(invites)
  })

  // PUT /channels/:channelId/recipients/:userId - add to group DM
  app.put('/:channelId/recipients/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, userId } = request.params as { channelId: string; userId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel || channel.type !== 'GROUP_DM') {
      return reply.status(404).send({ code: 404, message: 'Unknown channel' })
    }

    if (channel.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const existingMember = await prisma.directMessageMember.findFirst({
      where: { channelId, userId },
    })
    if (existingMember) return reply.status(204).send()

    await prisma.directMessageMember.create({
      data: { id: generateId(), channelId, userId },
    })

    const user = await prisma.user.findUnique({ where: { id: userId } })

    await publishEvent({
      type: 'CHANNEL_RECIPIENT_ADD',
      userId,
      data: {
        channelId,
        user: user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: userId },
      },
    })

    return reply.status(204).send()
  })

  // DELETE /channels/:channelId/recipients/:userId - remove from group DM
  app.delete('/:channelId/recipients/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { channelId, userId } = request.params as { channelId: string; userId: string }

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel || channel.type !== 'GROUP_DM') {
      return reply.status(404).send({ code: 404, message: 'Unknown channel' })
    }

    if (channel.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    await prisma.directMessageMember.deleteMany({ where: { channelId, userId } })

    const user = await prisma.user.findUnique({ where: { id: userId } })

    await publishEvent({
      type: 'CHANNEL_RECIPIENT_REMOVE',
      userId,
      data: {
        channelId,
        user: user ? { id: user.id, username: user.username, avatar: user.avatar } : { id: userId },
      },
    })

    return reply.status(204).send()
  })
}
