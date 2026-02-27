import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { prisma } from '../../lib/prisma.js'
import { publishEvent } from '../../lib/redis.js'
import { generateId } from '@freecord/snowflake'
import { serializeUser, serializeChannel } from '../../lib/serialize.js'

const updateMeSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_.]+$/).optional(),
  avatar: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
  bio: z.string().max(190).optional(),
  status: z.enum(['online', 'idle', 'dnd', 'invisible']).optional(),
  customStatus: z.string().max(128).nullable().optional(),
  locale: z.string().optional(),
  accentColor: z.number().nullable().optional(),
})

const updateSettingsSchema = z.object({
  theme: z.string().optional(),
  locale: z.string().optional(),
  messageDisplayCompact: z.boolean().optional(),
  developerMode: z.boolean().optional(),
  enableTTS: z.boolean().optional(),
  explicitContentFilter: z.number().optional(),
  defaultNotifications: z.number().optional(),
  guildPositions: z.array(z.string()).optional(),
  friendSourceFlags: z.number().optional(),
  restrictedGuilds: z.array(z.string()).optional(),
})

export default async function userRoutes(app: FastifyInstance) {
  // GET /users/@me - get own profile
  app.get('/@me', { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })
    return reply.send(serializeUser(user, true))
  })

  // PATCH /users/@me - update own profile
  app.patch('/@me', { preHandler: authenticate }, async (request, reply) => {
    const body = updateMeSchema.parse(request.body)

    // Check username uniqueness
    if (body.username) {
      const existing = await prisma.user.findFirst({
        where: { username: body.username, id: { not: request.userId } },
      })
      if (existing) {
        return reply.status(400).send({ code: 400, message: 'Username already taken' })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (body.username !== undefined) updateData.username = body.username
    if (body.avatar !== undefined) updateData.avatar = body.avatar
    if (body.banner !== undefined) updateData.banner = body.banner
    if (body.bio !== undefined) updateData.bio = body.bio
    if (body.status !== undefined) updateData.status = body.status.toUpperCase()
    if (body.customStatus !== undefined) updateData.customStatus = body.customStatus
    if (body.locale !== undefined) updateData.locale = body.locale
    if (body.accentColor !== undefined) updateData.accentColor = body.accentColor

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: updateData,
    })

    // Notify user's guilds of the update
    const guildMembers = await prisma.guildMember.findMany({
      where: { userId: request.userId },
      select: { guildId: true },
    })

    for (const { guildId } of guildMembers) {
      await publishEvent({
        type: 'USER_UPDATE',
        guildId,
        userId: request.userId,
        data: serializeUser(user),
      })
    }

    return reply.send(serializeUser(user, true))
  })

  // GET /users/:userId - get another user
  app.get('/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'Unknown user' })

    return reply.send(serializeUser(user))
  })

  // GET /users/@me/guilds - list guilds
  app.get('/@me/guilds', { preHandler: authenticate }, async (request, reply) => {
    const members = await prisma.guildMember.findMany({
      where: { userId: request.userId },
      include: {
        guild: {
          include: {
            roles: true,
            _count: { select: { members: true } },
          },
        },
      },
    })

    const guilds = members.map((m) => ({
      id: m.guild.id,
      name: m.guild.name,
      icon: m.guild.icon,
      banner: m.guild.banner,
      owner: m.guild.ownerId === request.userId,
      permissions: m.permissions || '0',
      features: m.guild.features,
      approximateMemberCount: m.guild._count.members,
    }))

    return reply.send(guilds)
  })

  // GET /users/@me/channels - list DM channels
  app.get('/@me/channels', { preHandler: authenticate }, async (request, reply) => {
    const dmMemberships = await prisma.directMessageMember.findMany({
      where: { userId: request.userId },
      include: {
        channel: {
          include: {
            dmMembers: { include: { user: true } },
          },
        },
      },
    })

    const channels = dmMemberships.map((m) => serializeChannel(m.channel))
    return reply.send(channels)
  })

  // POST /channels (create DM channel) - mounted under /users for Discord compat
  // We handle it here under /users/@me/channels as a POST
  app.post('/@me/channels', { preHandler: authenticate }, async (request, reply) => {
    const { recipientId } = z.object({ recipientId: z.string() }).parse(request.body)

    if (recipientId === request.userId) {
      return reply.status(400).send({ code: 400, message: 'Cannot DM yourself' })
    }

    const recipient = await prisma.user.findUnique({ where: { id: recipientId } })
    if (!recipient) return reply.status(404).send({ code: 404, message: 'Unknown user' })

    // Check if DM channel already exists
    const existingDm = await prisma.directMessageMember.findFirst({
      where: {
        userId: request.userId,
        channel: {
          type: 'DM',
          dmMembers: { some: { userId: recipientId } },
        },
      },
      include: {
        channel: { include: { dmMembers: { include: { user: true } } } },
      },
    })

    if (existingDm) {
      return reply.send(serializeChannel(existingDm.channel))
    }

    // Create new DM channel
    const channelId = generateId()
    const channel = await prisma.channel.create({
      data: {
        id: channelId,
        type: 'DM',
        dmMembers: {
          create: [
            { id: generateId(), userId: request.userId },
            { id: generateId(), userId: recipientId },
          ],
        },
      },
      include: { dmMembers: { include: { user: true } } },
    })

    const serialized = serializeChannel(channel)

    await publishEvent({
      type: 'CHANNEL_CREATE',
      userId: request.userId,
      data: serialized,
    })
    await publishEvent({
      type: 'CHANNEL_CREATE',
      userId: recipientId,
      data: serialized,
    })

    return reply.status(201).send(serialized)
  })

  // GET /users/@me/settings
  app.get('/@me/settings', { preHandler: authenticate }, async (request, reply) => {
    let settings = await prisma.userSettings.findUnique({ where: { userId: request.userId } })
    if (!settings) {
      settings = await prisma.userSettings.create({ data: { userId: request.userId } })
    }
    return reply.send(settings)
  })

  // PATCH /users/@me/settings
  app.patch('/@me/settings', { preHandler: authenticate }, async (request, reply) => {
    const body = updateSettingsSchema.parse(request.body)

    const settings = await prisma.userSettings.upsert({
      where: { userId: request.userId },
      update: body,
      create: { userId: request.userId, ...body },
    })

    return reply.send(settings)
  })

  // GET /users/@me/relationships
  app.get('/@me/relationships', { preHandler: authenticate }, async (request, reply) => {
    const relationships = await prisma.relationship.findMany({
      where: { OR: [{ userId: request.userId }, { targetId: request.userId }] },
      include: { user: true, target: true },
    })

    const result = relationships.map((r) => {
      const isInitiator = r.userId === request.userId
      const otherUser = isInitiator ? r.target : r.user
      return {
        id: r.id,
        type: r.type,
        user: serializeUser(otherUser),
        since: r.createdAt.toISOString(),
      }
    })

    return reply.send(result)
  })

  // POST /users/@me/relationships/find - find user by username#discriminator and send friend request
  app.post('/@me/relationships/find', { preHandler: authenticate }, async (request, reply) => {
    const { username, discriminator } = z
      .object({ username: z.string(), discriminator: z.string().optional() })
      .parse(request.body)

    const target = await prisma.user.findFirst({
      where: {
        username,
        ...(discriminator ? { discriminator } : {}),
        id: { not: request.userId },
      },
    })

    if (!target) {
      return reply.status(404).send({ code: 10013, message: 'Unknown user' })
    }

    // Re-use existing relationship logic by delegating to the same code path
    const existing = await prisma.relationship.findFirst({
      where: {
        OR: [
          { userId: request.userId, targetId: target.id },
          { userId: target.id, targetId: request.userId },
        ],
      },
    })

    if (existing?.type === 'FRIEND') {
      return reply.status(400).send({ code: 400, message: 'Already friends with this user' })
    }
    if (existing?.type === 'BLOCKED') {
      return reply.status(400).send({ code: 400, message: 'Cannot send friend request' })
    }
    if (existing?.type === 'PENDING_OUTGOING' && existing.userId === request.userId) {
      return reply.status(400).send({ code: 400, message: 'Friend request already pending' })
    }

    // If they already sent us a request, accept it
    if (existing && existing.targetId === request.userId) {
      await prisma.relationship.update({ where: { id: existing.id }, data: { type: 'FRIEND' } })
      const outgoing = await prisma.relationship.findFirst({
        where: { userId: target.id, targetId: request.userId },
      })
      if (outgoing) {
        await prisma.relationship.update({ where: { id: outgoing.id }, data: { type: 'FRIEND' } })
      }
      await publishEvent({ type: 'RELATIONSHIP_UPDATE', userId: request.userId, data: { id: existing.id, type: 'FRIEND', user: serializeUser(target) } })
      const me = await prisma.user.findUnique({ where: { id: request.userId } })
      await publishEvent({ type: 'RELATIONSHIP_UPDATE', userId: target.id, data: { id: existing.id, type: 'FRIEND', user: serializeUser(me!) } })
      return reply.status(204).send()
    }

    const [outgoing, incoming] = await prisma.$transaction([
      prisma.relationship.create({
        data: { id: generateId(), userId: request.userId, targetId: target.id, type: 'PENDING_OUTGOING' },
      }),
      prisma.relationship.create({
        data: { id: generateId(), userId: target.id, targetId: request.userId, type: 'PENDING_INCOMING' },
      }),
    ])

    const me = await prisma.user.findUnique({ where: { id: request.userId } })
    await publishEvent({ type: 'RELATIONSHIP_ADD', userId: request.userId, data: { id: outgoing.id, type: 'PENDING_OUTGOING', user: serializeUser(target) } })
    await publishEvent({ type: 'RELATIONSHIP_ADD', userId: target.id, data: { id: incoming.id, type: 'PENDING_INCOMING', user: serializeUser(me!) } })

    return reply.status(204).send()
  })

  // POST /users/@me/relationships/:userId - send friend request
  app.post('/@me/relationships/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { userId: targetId } = request.params as { userId: string }

    if (targetId === request.userId) {
      return reply.status(400).send({ code: 400, message: 'Cannot add yourself as a friend' })
    }

    const target = await prisma.user.findUnique({ where: { id: targetId } })
    if (!target) return reply.status(404).send({ code: 404, message: 'Unknown user' })

    // Check for existing relationship
    const existing = await prisma.relationship.findFirst({
      where: {
        OR: [
          { userId: request.userId, targetId },
          { userId: targetId, targetId: request.userId },
        ],
      },
    })

    if (existing) {
      // If the other person already sent us a request, accept it
      if (existing.type === 'PENDING_INCOMING' && existing.targetId === request.userId) {
        // Accept the incoming request
        await prisma.$transaction([
          prisma.relationship.update({
            where: { id: existing.id },
            data: { type: 'FRIEND' },
          }),
        ])

        const updated = await prisma.relationship.findUnique({
          where: { id: existing.id },
          include: { user: true, target: true },
        })

        await publishEvent({
          type: 'RELATIONSHIP_UPDATE',
          userId: request.userId,
          data: { id: existing.id, type: 'FRIEND', user: serializeUser(target) },
        })
        await publishEvent({
          type: 'RELATIONSHIP_UPDATE',
          userId: targetId,
          data: { id: existing.id, type: 'FRIEND', user: serializeUser(updated!.user) },
        })

        return reply.status(204).send()
      }

      if (existing.type === 'FRIEND') {
        return reply.status(400).send({ code: 400, message: 'Already friends' })
      }
      if (existing.type === 'BLOCKED') {
        return reply.status(400).send({ code: 400, message: 'Cannot send friend request' })
      }
      return reply.status(400).send({ code: 400, message: 'Friend request already pending' })
    }

    // Create outgoing request for sender, incoming for receiver
    const [outgoing, incoming] = await prisma.$transaction([
      prisma.relationship.create({
        data: {
          id: generateId(),
          userId: request.userId,
          targetId,
          type: 'PENDING_OUTGOING',
        },
      }),
      prisma.relationship.create({
        data: {
          id: generateId(),
          userId: targetId,
          targetId: request.userId,
          type: 'PENDING_INCOMING',
        },
      }),
    ])

    await publishEvent({
      type: 'RELATIONSHIP_ADD',
      userId: request.userId,
      data: { id: outgoing.id, type: 'PENDING_OUTGOING', user: serializeUser(target) },
    })

    const currentUser = await prisma.user.findUnique({ where: { id: request.userId } })
    await publishEvent({
      type: 'RELATIONSHIP_ADD',
      userId: targetId,
      data: { id: incoming.id, type: 'PENDING_INCOMING', user: serializeUser(currentUser!) },
    })

    return reply.status(204).send()
  })

  // PUT /users/@me/relationships/:userId - accept friend request or block
  app.put('/@me/relationships/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { userId: targetId } = request.params as { userId: string }
    const { type } = z.object({ type: z.number().optional() }).parse(request.body || {})

    // type 2 = block
    if (type === 2) {
      // Block: remove any existing relationship, create blocked
      await prisma.relationship.deleteMany({
        where: {
          OR: [
            { userId: request.userId, targetId },
            { userId: targetId, targetId: request.userId },
          ],
        },
      })

      const rel = await prisma.relationship.create({
        data: {
          id: generateId(),
          userId: request.userId,
          targetId,
          type: 'BLOCKED',
        },
      })

      const target = await prisma.user.findUnique({ where: { id: targetId } })

      await publishEvent({
        type: 'RELATIONSHIP_ADD',
        userId: request.userId,
        data: { id: rel.id, type: 'BLOCKED', user: serializeUser(target!) },
      })
      await publishEvent({
        type: 'RELATIONSHIP_REMOVE',
        userId: targetId,
        data: { id: rel.id },
      })

      return reply.status(204).send()
    }

    // Accept incoming friend request
    const incoming = await prisma.relationship.findFirst({
      where: { userId: request.userId, targetId, type: 'PENDING_INCOMING' },
    })

    if (!incoming) {
      return reply.status(404).send({ code: 404, message: 'No pending friend request from this user' })
    }

    // Find the corresponding outgoing from target
    const outgoing = await prisma.relationship.findFirst({
      where: { userId: targetId, targetId: request.userId, type: 'PENDING_OUTGOING' },
    })

    await prisma.$transaction([
      prisma.relationship.update({ where: { id: incoming.id }, data: { type: 'FRIEND' } }),
      ...(outgoing
        ? [prisma.relationship.update({ where: { id: outgoing.id }, data: { type: 'FRIEND' } })]
        : []),
    ])

    const target = await prisma.user.findUnique({ where: { id: targetId } })
    const currentUser = await prisma.user.findUnique({ where: { id: request.userId } })

    await publishEvent({
      type: 'RELATIONSHIP_UPDATE',
      userId: request.userId,
      data: { id: incoming.id, type: 'FRIEND', user: serializeUser(target!) },
    })
    if (outgoing) {
      await publishEvent({
        type: 'RELATIONSHIP_UPDATE',
        userId: targetId,
        data: { id: outgoing.id, type: 'FRIEND', user: serializeUser(currentUser!) },
      })
    }

    return reply.status(204).send()
  })

  // DELETE /users/@me/relationships/:userId - remove friend/block
  app.delete('/@me/relationships/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { userId: targetId } = request.params as { userId: string }

    const relationships = await prisma.relationship.findMany({
      where: {
        OR: [
          { userId: request.userId, targetId },
          { userId: targetId, targetId: request.userId },
        ],
      },
    })

    if (relationships.length === 0) {
      return reply.status(404).send({ code: 404, message: 'No relationship found' })
    }

    await prisma.relationship.deleteMany({
      where: {
        OR: [
          { userId: request.userId, targetId },
          { userId: targetId, targetId: request.userId },
        ],
      },
    })

    for (const rel of relationships) {
      await publishEvent({
        type: 'RELATIONSHIP_REMOVE',
        userId: rel.userId,
        data: { id: rel.id, userId: rel.targetId },
      })
    }

    return reply.status(204).send()
  })

  // GET /users/@me/read-states
  app.get('/@me/read-states', { preHandler: authenticate }, async (request, reply) => {
    const readStates = await prisma.readState.findMany({
      where: { userId: request.userId },
    })

    return reply.send(
      readStates.map((rs) => ({
        id: rs.id,
        channelId: rs.channelId,
        lastMessageId: rs.lastMessageId,
        mentionCount: rs.mentionCount,
        lastPinTimestamp: rs.lastPinTimestamp?.toISOString() ?? null,
      }))
    )
  })

  // POST /users/@me/read-states/:channelId/ack - acknowledge messages
  app.post('/@me/read-states/:channelId/ack', { preHandler: authenticate }, async (request, reply) => {
    const { channelId } = request.params as { channelId: string }
    const { messageId } = z.object({ messageId: z.string().optional() }).parse(request.body || {})

    const channel = await prisma.channel.findUnique({ where: { id: channelId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    await prisma.readState.upsert({
      where: { userId_channelId: { userId: request.userId, channelId } },
      update: {
        lastMessageId: messageId || channel.lastMessageId,
        mentionCount: 0,
      },
      create: {
        id: generateId(),
        userId: request.userId,
        channelId,
        lastMessageId: messageId || channel.lastMessageId,
        mentionCount: 0,
      },
    })

    return reply.status(204).send()
  })
}
