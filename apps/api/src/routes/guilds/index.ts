import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { prisma } from '../../lib/prisma.js'
import { publishEvent } from '../../lib/redis.js'
import { generateId } from '@freecord/snowflake'
import { generateRandomString } from '../../lib/hash.js'
import {
  serializeUser,
  serializeChannel,
  serializeRole,
  serializeGuildMember,
} from '../../lib/serialize.js'

// Default permission bitfield for @everyone
const DEFAULT_PERMISSIONS = '1071698660929'

const createGuildSchema = z.object({
  name: z.string().min(2).max(100),
  icon: z.string().optional(),
  region: z.string().optional(),
  afkTimeout: z.number().optional(),
  verificationLevel: z.number().min(0).max(4).optional(),
  defaultMessageNotifications: z.number().min(0).max(1).optional(),
  explicitContentFilter: z.number().min(0).max(2).optional(),
})

const updateGuildSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  icon: z.string().nullable().optional(),
  banner: z.string().nullable().optional(),
  splash: z.string().nullable().optional(),
  description: z.string().max(120).nullable().optional(),
  ownerId: z.string().optional(),
  afkChannelId: z.string().nullable().optional(),
  afkTimeout: z.number().optional(),
  systemChannelId: z.string().nullable().optional(),
  rulesChannelId: z.string().nullable().optional(),
  publicUpdatesChannelId: z.string().nullable().optional(),
  verificationLevel: z.number().min(0).max(4).optional(),
  defaultMessageNotifications: z.number().min(0).max(1).optional(),
  explicitContentFilter: z.number().min(0).max(2).optional(),
  mfaLevel: z.number().min(0).max(1).optional(),
  preferredLocale: z.string().optional(),
  features: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
})

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.number().min(0).max(13).optional(),
  topic: z.string().max(1024).optional(),
  position: z.number().optional(),
  parentId: z.string().nullable().optional(),
  nsfw: z.boolean().optional(),
  slowmode: z.number().min(0).max(21600).optional(),
  bitrate: z.number().optional(),
  userLimit: z.number().optional(),
  rtcRegion: z.string().nullable().optional(),
  permissionOverwrites: z.array(z.unknown()).optional(),
})

const createRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.string().optional(),
  color: z.number().optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  unicodeEmoji: z.string().nullable().optional(),
})

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.string().optional(),
  color: z.number().optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  unicodeEmoji: z.string().nullable().optional(),
  position: z.number().optional(),
})

function channelTypeNumberToEnum(type: number): string {
  const map: Record<number, string> = {
    0: 'GUILD_TEXT',
    1: 'DM',
    2: 'GUILD_VOICE',
    3: 'GROUP_DM',
    4: 'GUILD_CATEGORY',
    5: 'GUILD_ANNOUNCEMENT',
    11: 'PUBLIC_THREAD',
    12: 'PRIVATE_THREAD',
    13: 'GUILD_STAGE_VOICE',
  }
  return map[type] ?? 'GUILD_TEXT'
}

async function getFullGuild(guildId: string, userId: string) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: {
      channels: { orderBy: { position: 'asc' } },
      roles: { orderBy: { position: 'asc' } },
      emojis: true,
      members: {
        include: { user: true },
        take: 100,
        orderBy: { joinedAt: 'asc' },
      },
      _count: { select: { members: true } },
    },
  })
  return guild
}

export default async function guildRoutes(app: FastifyInstance) {
  // GET /guilds/public - public server discovery (no auth required)
  app.get('/public', async (request, reply) => {
    const { q = '', limit = 48, offset = 0 } = request.query as { q?: string; limit?: number; offset?: number }
    const take = Math.min(Number(limit), 100)
    const skip = Number(offset)

    const where: any = { isPublic: true }
    if (q.trim()) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { description: { contains: q.trim(), mode: 'insensitive' } },
      ]
    }

    const [guilds, total] = await Promise.all([
      prisma.guild.findMany({
        where,
        take,
        skip,
        orderBy: { members: { _count: 'desc' } },
        include: { _count: { select: { members: true } } },
      }),
      prisma.guild.count({ where }),
    ])

    return reply.send({
      guilds: guilds.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        banner: g.banner,
        description: g.description,
        approximateMemberCount: g._count.members,
        features: g.features,
        vanityUrlCode: g.vanityCode,
      })),
      total,
    })
  })

  // GET /guilds - list user's guilds
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const members = await prisma.guildMember.findMany({
      where: { userId: request.userId },
      include: {
        guild: {
          include: { roles: true, _count: { select: { members: true } } },
        },
      },
    })

    return reply.send(
      members.map((m) => ({
        id: m.guild.id,
        name: m.guild.name,
        icon: m.guild.icon,
        banner: m.guild.banner,
        owner: m.guild.ownerId === request.userId,
        permissions: m.permissions || '0',
        features: m.guild.features,
        approximateMemberCount: m.guild._count.members,
      }))
    )
  })

  // POST /guilds - create guild
  app.post('/', { preHandler: authenticate }, async (request, reply) => {
    const body = createGuildSchema.parse(request.body)

    const guildId = generateId()
    const everyoneRoleId = generateId()
    const categoryId = generateId()
    const textChannelId = generateId()
    const voiceChannelId = generateId()

    const guild = await prisma.$transaction(async (tx) => {
      // Create guild
      const g = await tx.guild.create({
        data: {
          id: guildId,
          name: body.name,
          icon: body.icon,
          ownerId: request.userId,
          afkTimeout: body.afkTimeout ?? 300,
          verificationLevel: body.verificationLevel ?? 0,
          defaultMessageNotifications: body.defaultMessageNotifications ?? 0,
          explicitContentFilter: body.explicitContentFilter ?? 0,
          systemChannelId: textChannelId,
        },
      })

      // Create @everyone role
      await tx.role.create({
        data: {
          id: everyoneRoleId,
          guildId,
          name: '@everyone',
          position: 0,
          permissions: DEFAULT_PERMISSIONS,
        },
      })

      // Create General category
      await tx.channel.create({
        data: {
          id: categoryId,
          type: 'GUILD_CATEGORY',
          guildId,
          name: 'General',
          position: 0,
        },
      })

      // Create #general text channel
      await tx.channel.create({
        data: {
          id: textChannelId,
          type: 'GUILD_TEXT',
          guildId,
          name: 'general',
          position: 0,
          parentId: categoryId,
        },
      })

      // Create General voice channel
      await tx.channel.create({
        data: {
          id: voiceChannelId,
          type: 'GUILD_VOICE',
          guildId,
          name: 'General',
          position: 1,
          parentId: categoryId,
          bitrate: 64000,
          userLimit: 0,
        },
      })

      // Add creator as member
      await tx.guildMember.create({
        data: {
          id: generateId(),
          guildId,
          userId: request.userId,
          roles: [everyoneRoleId],
        },
      })

      return g
    })

    const fullGuild = await getFullGuild(guildId, request.userId)

    await publishEvent({
      type: 'GUILD_CREATE',
      userId: request.userId,
      data: fullGuild,
    })

    return reply.status(201).send(fullGuild)
  })

  // GET /guilds/:guildId - get guild
  app.get('/:guildId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const guild = await getFullGuild(guildId, request.userId)
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    return reply.send(guild)
  })

  // PATCH /guilds/:guildId - update guild
  app.patch('/:guildId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = updateGuildSchema.parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member || guild.ownerId !== request.userId) {
      // Could also check MANAGE_GUILD permission from roles
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.banner !== undefined) updateData.banner = body.banner
    if (body.splash !== undefined) updateData.splash = body.splash
    if (body.description !== undefined) updateData.description = body.description
    if (body.ownerId !== undefined) updateData.ownerId = body.ownerId
    if (body.afkChannelId !== undefined) updateData.afkChannelId = body.afkChannelId
    if (body.afkTimeout !== undefined) updateData.afkTimeout = body.afkTimeout
    if (body.systemChannelId !== undefined) updateData.systemChannelId = body.systemChannelId
    if (body.rulesChannelId !== undefined) updateData.rulesChannelId = body.rulesChannelId
    if (body.publicUpdatesChannelId !== undefined) updateData.publicUpdatesChannelId = body.publicUpdatesChannelId
    if (body.verificationLevel !== undefined) updateData.verificationLevel = body.verificationLevel
    if (body.defaultMessageNotifications !== undefined) updateData.defaultMessageNotifications = body.defaultMessageNotifications
    if (body.explicitContentFilter !== undefined) updateData.explicitContentFilter = body.explicitContentFilter
    if (body.mfaLevel !== undefined) updateData.mfaLevel = body.mfaLevel
    if (body.preferredLocale !== undefined) updateData.preferredLocale = body.preferredLocale
    if (body.features !== undefined) updateData.features = body.features
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic

    const updated = await prisma.guild.update({ where: { id: guildId }, data: updateData })

    await publishEvent({
      type: 'GUILD_UPDATE',
      guildId,
      data: updated,
    })

    await prisma.auditLog.create({
      data: { id: generateId(), guildId, userId: request.userId, targetId: guildId, actionType: 1, changes: updateData as any },
    }).catch(() => {})

    return reply.send(updated)
  })

  // DELETE /guilds/:guildId - delete guild (owner only)
  app.delete('/:guildId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })
    if (guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Only the guild owner can delete the server' })
    }

    await prisma.guild.delete({ where: { id: guildId } })

    await publishEvent({
      type: 'GUILD_DELETE',
      guildId,
      data: { id: guildId },
    })

    return reply.status(204).send()
  })

  // POST /guilds/:guildId/leave - leave guild
  app.post('/:guildId/leave', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    if (guild.ownerId === request.userId) {
      return reply.status(400).send({ code: 400, message: 'Guild owner cannot leave. Transfer ownership or delete the guild.' })
    }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(404).send({ code: 404, message: 'Not a member' })

    await prisma.$transaction([
      prisma.guildMember.delete({ where: { id: member.id } }),
      prisma.guild.update({ where: { id: guildId }, data: { memberCount: { decrement: 1 } } }),
    ])

    await publishEvent({
      type: 'GUILD_MEMBER_REMOVE',
      guildId,
      data: { guildId, user: { id: request.userId } },
    })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/preview - public preview
  app.get('/:guildId/preview', async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { emojis: true, _count: { select: { members: true } } },
    })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    return reply.send({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      splash: guild.splash,
      description: guild.description,
      features: guild.features,
      emojis: guild.emojis,
      approximateMemberCount: guild._count.members,
      approximatePresenceCount: 0,
    })
  })

  // GET /guilds/:guildId/channels
  app.get('/:guildId/channels', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const channels = await prisma.channel.findMany({
      where: { guildId },
      orderBy: { position: 'asc' },
    })

    return reply.send(channels.map(serializeChannel))
  })

  // POST /guilds/:guildId/channels - create channel
  app.post('/:guildId/channels', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = createChannelSchema.parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    // Check permission (owner or MANAGE_CHANNELS)
    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const typeEnum = channelTypeNumberToEnum(body.type ?? 0)

    const channel = await prisma.channel.create({
      data: {
        id: generateId(),
        guildId,
        type: typeEnum as any,
        name: body.name,
        topic: body.topic,
        position: body.position ?? 0,
        parentId: body.parentId,
        nsfw: body.nsfw ?? false,
        slowmode: body.slowmode ?? 0,
        bitrate: body.bitrate,
        userLimit: body.userLimit,
        rtcRegion: body.rtcRegion,
        permissionOverwrites: (body.permissionOverwrites ?? []) as any,
      },
    })

    const serialized = serializeChannel(channel)

    await publishEvent({
      type: 'CHANNEL_CREATE',
      guildId,
      data: serialized,
    })

    await prisma.auditLog.create({
      data: { id: generateId(), guildId, userId: request.userId, targetId: channel.id, actionType: 10, changes: { name: body.name, type: body.type } as any },
    }).catch(() => {})

    return reply.status(201).send(serialized)
  })

  // PATCH /guilds/:guildId/channels - bulk update positions
  app.patch('/:guildId/channels', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const updates = z.array(z.object({ id: z.string(), position: z.number(), parentId: z.string().nullable().optional() })).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.channel.update({
          where: { id: u.id },
          data: { position: u.position, parentId: u.parentId },
        })
      )
    )

    const channels = await prisma.channel.findMany({ where: { guildId }, orderBy: { position: 'asc' } })

    await publishEvent({ type: 'CHANNEL_POSITIONS_UPDATE', guildId, data: channels.map(serializeChannel) })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/members
  app.get('/:guildId/members', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { limit = 1000, after } = request.query as { limit?: number; after?: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const members = await prisma.guildMember.findMany({
      where: {
        guildId,
        ...(after ? { id: { gt: after } } : {}),
      },
      include: { user: true },
      take: Math.min(Number(limit), 1000),
      orderBy: { joinedAt: 'asc' },
    })

    return reply.send(members.map(serializeGuildMember))
  })

  // GET /guilds/:guildId/members/:userId
  app.get('/:guildId/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }

    const requesterMember = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!requesterMember) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const target = userId === '@me' ? request.userId : userId
    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: target } },
      include: { user: true },
    })
    if (!member) return reply.status(404).send({ code: 404, message: 'Unknown member' })

    return reply.send(serializeGuildMember(member))
  })

  // PATCH /guilds/:guildId/members/@me - update own nickname
  app.patch('/:guildId/members/@me', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { nick } = z.object({ nick: z.string().max(32).nullable().optional() }).parse(request.body)

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
      include: { user: true },
    })
    if (!member) return reply.status(404).send({ code: 404, message: 'Unknown member' })

    const updated = await prisma.guildMember.update({
      where: { id: member.id },
      data: { nickname: nick ?? null },
      include: { user: true },
    })

    await publishEvent({
      type: 'GUILD_MEMBER_UPDATE',
      guildId,
      data: serializeGuildMember(updated),
    })

    return reply.send(serializeGuildMember(updated))
  })

  // PATCH /guilds/:guildId/members/:userId - update member
  app.patch('/:guildId/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const body = z.object({
      nick: z.string().max(32).nullable().optional(),
      roles: z.array(z.string()).optional(),
      mute: z.boolean().optional(),
      deaf: z.boolean().optional(),
      channelId: z.string().nullable().optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    // Permission check - must be owner or have appropriate permissions
    if (guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const targetMember = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { user: true },
    })
    if (!targetMember) return reply.status(404).send({ code: 404, message: 'Unknown member' })

    const updateData: Record<string, unknown> = {}
    if (body.nick !== undefined) updateData.nickname = body.nick
    if (body.roles !== undefined) updateData.roles = body.roles
    if (body.mute !== undefined) updateData.mute = body.mute
    if (body.deaf !== undefined) updateData.deaf = body.deaf

    const updated = await prisma.guildMember.update({
      where: { id: targetMember.id },
      data: updateData,
      include: { user: true },
    })

    await publishEvent({
      type: 'GUILD_MEMBER_UPDATE',
      guildId,
      data: serializeGuildMember(updated),
    })

    return reply.send(serializeGuildMember(updated))
  })

  // DELETE /guilds/:guildId/members/:userId - kick member
  app.delete('/:guildId/members/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })
    if (guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }
    if (userId === request.userId) {
      return reply.status(400).send({ code: 400, message: 'Cannot kick yourself' })
    }

    const target = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { user: true },
    })
    if (!target) return reply.status(404).send({ code: 404, message: 'Unknown member' })

    await prisma.$transaction([
      prisma.guildMember.delete({ where: { id: target.id } }),
      prisma.guild.update({ where: { id: guildId }, data: { memberCount: { decrement: 1 } } }),
    ])

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        id: generateId(),
        guildId,
        userId: request.userId,
        targetId: userId,
        actionType: 20, // MEMBER_KICK
      },
    })

    await publishEvent({
      type: 'GUILD_MEMBER_REMOVE',
      guildId,
      data: { guildId, user: serializeUser(target.user) },
    })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/roles
  app.get('/:guildId/roles', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const roles = await prisma.role.findMany({
      where: { guildId },
      orderBy: { position: 'desc' },
    })

    return reply.send(roles.map(serializeRole))
  })

  // POST /guilds/:guildId/roles - create role
  app.post('/:guildId/roles', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = createRoleSchema.parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    // Get highest position
    const topRole = await prisma.role.findFirst({
      where: { guildId },
      orderBy: { position: 'desc' },
    })

    const role = await prisma.role.create({
      data: {
        id: generateId(),
        guildId,
        name: body.name ?? 'new role',
        permissions: body.permissions ?? '0',
        color: body.color ?? 0,
        hoist: body.hoist ?? false,
        mentionable: body.mentionable ?? false,
        icon: body.icon,
        unicodeEmoji: body.unicodeEmoji,
        position: (topRole?.position ?? 0) + 1,
      },
    })

    await publishEvent({
      type: 'GUILD_ROLE_CREATE',
      guildId,
      data: { guildId, role: serializeRole(role) },
    })

    await prisma.auditLog.create({
      data: { id: generateId(), guildId, userId: request.userId, targetId: role.id, actionType: 30, changes: { name: role.name } as any },
    }).catch(() => {})

    return reply.status(201).send(serializeRole(role))
  })

  // PATCH /guilds/:guildId/roles/:roleId - update role
  app.patch('/:guildId/roles/:roleId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, roleId } = request.params as { guildId: string; roleId: string }
    const body = updateRoleSchema.parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const role = await prisma.role.findFirst({ where: { id: roleId, guildId } })
    if (!role) return reply.status(404).send({ code: 404, message: 'Unknown role' })
    if (role.name === '@everyone' && body.name) {
      return reply.status(400).send({ code: 400, message: 'Cannot rename @everyone' })
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.permissions !== undefined) updateData.permissions = body.permissions
    if (body.color !== undefined) updateData.color = body.color
    if (body.hoist !== undefined) updateData.hoist = body.hoist
    if (body.mentionable !== undefined) updateData.mentionable = body.mentionable
    if (body.icon !== undefined) updateData.icon = body.icon
    if (body.unicodeEmoji !== undefined) updateData.unicodeEmoji = body.unicodeEmoji
    if (body.position !== undefined) updateData.position = body.position

    const updated = await prisma.role.update({ where: { id: roleId }, data: updateData })

    await publishEvent({
      type: 'GUILD_ROLE_UPDATE',
      guildId,
      data: { guildId, role: serializeRole(updated) },
    })

    return reply.send(serializeRole(updated))
  })

  // DELETE /guilds/:guildId/roles/:roleId
  app.delete('/:guildId/roles/:roleId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, roleId } = request.params as { guildId: string; roleId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const role = await prisma.role.findFirst({ where: { id: roleId, guildId } })
    if (!role) return reply.status(404).send({ code: 404, message: 'Unknown role' })
    if (role.name === '@everyone') {
      return reply.status(400).send({ code: 400, message: 'Cannot delete @everyone role' })
    }

    await prisma.role.delete({ where: { id: roleId } })

    await publishEvent({
      type: 'GUILD_ROLE_DELETE',
      guildId,
      data: { guildId, roleId },
    })

    await prisma.auditLog.create({
      data: { id: generateId(), guildId, userId: request.userId, targetId: roleId, actionType: 32, changes: { name: role.name } as any },
    }).catch(() => {})

    return reply.status(204).send()
  })

  // PUT /guilds/:guildId/members/:userId/roles/:roleId - add role to member
  app.put('/:guildId/members/:userId/roles/:roleId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId, roleId } = request.params as {
      guildId: string; userId: string; roleId: string
    }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const role = await prisma.role.findFirst({ where: { id: roleId, guildId } })
    if (!role) return reply.status(404).send({ code: 404, message: 'Unknown role' })

    const target = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { user: true },
    })
    if (!target) return reply.status(404).send({ code: 404, message: 'Unknown member' })

    if (target.roles.includes(roleId)) return reply.status(204).send()

    const updated = await prisma.guildMember.update({
      where: { id: target.id },
      data: { roles: { push: roleId } },
      include: { user: true },
    })

    await publishEvent({
      type: 'GUILD_MEMBER_UPDATE',
      guildId,
      data: serializeGuildMember(updated),
    })

    return reply.status(204).send()
  })

  // DELETE /guilds/:guildId/members/:userId/roles/:roleId - remove role from member
  app.delete('/:guildId/members/:userId/roles/:roleId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId, roleId } = request.params as {
      guildId: string; userId: string; roleId: string
    }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const target = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { user: true },
    })
    if (!target) return reply.status(404).send({ code: 404, message: 'Unknown member' })

    const updated = await prisma.guildMember.update({
      where: { id: target.id },
      data: { roles: target.roles.filter((r) => r !== roleId) },
      include: { user: true },
    })

    await publishEvent({
      type: 'GUILD_MEMBER_UPDATE',
      guildId,
      data: serializeGuildMember(updated),
    })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/bans
  app.get('/:guildId/bans', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const bans = await prisma.guildBan.findMany({ where: { guildId } })
    const users = await prisma.user.findMany({
      where: { id: { in: bans.map((b) => b.userId) } },
    })

    const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

    return reply.send(
      bans.map((b) => ({
        reason: b.reason,
        user: userMap[b.userId] ? serializeUser(userMap[b.userId]) : { id: b.userId },
      }))
    )
  })

  // GET /guilds/:guildId/bans/:userId
  app.get('/:guildId/bans/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const ban = await prisma.guildBan.findUnique({
      where: { guildId_userId: { guildId, userId } },
    })
    if (!ban) return reply.status(404).send({ code: 404, message: 'Unknown ban' })

    const user = await prisma.user.findUnique({ where: { id: userId } })

    return reply.send({
      reason: ban.reason,
      user: user ? serializeUser(user) : { id: userId },
    })
  })

  // PUT /guilds/:guildId/bans/:userId - ban user
  app.put('/:guildId/bans/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const { reason, deleteMessageDays } = z.object({
      reason: z.string().max(512).optional(),
      deleteMessageDays: z.number().min(0).max(7).optional(),
    }).parse(request.body || {})

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    if (userId === guild.ownerId) {
      return reply.status(400).send({ code: 400, message: 'Cannot ban the guild owner' })
    }

    // Create ban, kick member if present
    await prisma.$transaction(async (tx) => {
      await tx.guildBan.upsert({
        where: { guildId_userId: { guildId, userId } },
        create: { id: generateId(), guildId, userId, reason },
        update: { reason },
      })

      const member = await tx.guildMember.findUnique({
        where: { guildId_userId: { guildId, userId } },
      })

      if (member) {
        await tx.guildMember.delete({ where: { id: member.id } })
        await tx.guild.update({ where: { id: guildId }, data: { memberCount: { decrement: 1 } } })
      }

      await tx.auditLog.create({
        data: {
          id: generateId(),
          guildId,
          userId: request.userId,
          targetId: userId,
          actionType: 22, // MEMBER_BAN_ADD
          reason,
        },
      })
    })

    const bannedUser = await prisma.user.findUnique({ where: { id: userId } })

    await publishEvent({
      type: 'GUILD_BAN_ADD',
      guildId,
      data: { guildId, user: bannedUser ? serializeUser(bannedUser) : { id: userId } },
    })
    await publishEvent({
      type: 'GUILD_MEMBER_REMOVE',
      guildId,
      data: { guildId, user: bannedUser ? serializeUser(bannedUser) : { id: userId } },
    })

    return reply.status(204).send()
  })

  // DELETE /guilds/:guildId/bans/:userId - unban
  app.delete('/:guildId/bans/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const ban = await prisma.guildBan.findUnique({
      where: { guildId_userId: { guildId, userId } },
    })
    if (!ban) return reply.status(404).send({ code: 404, message: 'Unknown ban' })

    await prisma.guildBan.delete({ where: { guildId_userId: { guildId, userId } } })

    await prisma.auditLog.create({
      data: {
        id: generateId(),
        guildId,
        userId: request.userId,
        targetId: userId,
        actionType: 23, // MEMBER_BAN_REMOVE
      },
    })

    const unbannedUser = await prisma.user.findUnique({ where: { id: userId } })

    await publishEvent({
      type: 'GUILD_BAN_REMOVE',
      guildId,
      data: { guildId, user: unbannedUser ? serializeUser(unbannedUser) : { id: userId } },
    })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/invites
  app.get('/:guildId/invites', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const invites = await prisma.guildInvite.findMany({ where: { guildId } })

    return reply.send(
      invites.map((i) => ({
        code: i.code,
        guildId: i.guildId,
        channelId: i.channelId,
        inviterId: i.inviterId,
        uses: i.uses,
        maxUses: i.maxUses,
        maxAge: i.maxAge,
        temporary: i.temporary,
        createdAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt?.toISOString() ?? null,
      }))
    )
  })

  // GET /guilds/:guildId/emojis
  app.get('/:guildId/emojis', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const emojis = await prisma.emoji.findMany({ where: { guildId } })
    return reply.send(emojis)
  })

  // POST /guilds/:guildId/emojis - create emoji
  app.post('/:guildId/emojis', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { name, image, roles } = z.object({
      name: z.string().min(2).max(32),
      image: z.string(),
      roles: z.array(z.string()).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const emoji = await prisma.emoji.create({
      data: {
        id: generateId(),
        guildId,
        name,
        userId: request.userId,
        roles: roles ?? [],
        animated: image.startsWith('data:image/gif'),
      },
    })

    await publishEvent({
      type: 'GUILD_EMOJIS_UPDATE',
      guildId,
      data: { guildId, emojis: await prisma.emoji.findMany({ where: { guildId } }) },
    })

    return reply.status(201).send(emoji)
  })

  // PATCH /guilds/:guildId/emojis/:emojiId
  app.patch('/:guildId/emojis/:emojiId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, emojiId } = request.params as { guildId: string; emojiId: string }
    const { name, roles } = z.object({
      name: z.string().min(2).max(32).optional(),
      roles: z.array(z.string()).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const emoji = await prisma.emoji.findFirst({ where: { id: emojiId, guildId } })
    if (!emoji) return reply.status(404).send({ code: 404, message: 'Unknown emoji' })

    const updated = await prisma.emoji.update({
      where: { id: emojiId },
      data: { name, roles },
    })

    await publishEvent({
      type: 'GUILD_EMOJIS_UPDATE',
      guildId,
      data: { guildId, emojis: await prisma.emoji.findMany({ where: { guildId } }) },
    })

    return reply.send(updated)
  })

  // DELETE /guilds/:guildId/emojis/:emojiId
  app.delete('/:guildId/emojis/:emojiId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, emojiId } = request.params as { guildId: string; emojiId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const emoji = await prisma.emoji.findFirst({ where: { id: emojiId, guildId } })
    if (!emoji) return reply.status(404).send({ code: 404, message: 'Unknown emoji' })

    await prisma.emoji.delete({ where: { id: emojiId } })

    await publishEvent({
      type: 'GUILD_EMOJIS_UPDATE',
      guildId,
      data: { guildId, emojis: await prisma.emoji.findMany({ where: { guildId } }) },
    })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/webhooks
  app.get('/:guildId/webhooks', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const webhooks = await prisma.webhook.findMany({ where: { guildId } })
    return reply.send(webhooks)
  })

  // POST /guilds/:guildId/webhooks
  app.post('/:guildId/webhooks', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { name, avatar, channelId } = z.object({
      name: z.string().min(1).max(80),
      avatar: z.string().optional(),
      channelId: z.string(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const channel = await prisma.channel.findFirst({ where: { id: channelId, guildId } })
    if (!channel) return reply.status(404).send({ code: 404, message: 'Unknown channel' })

    const webhook = await prisma.webhook.create({
      data: {
        id: generateId(),
        guildId,
        channelId,
        userId: request.userId,
        name,
        avatar,
        token: generateRandomString(64),
      },
    })

    return reply.status(201).send(webhook)
  })

  // GET /guilds/:guildId/audit-logs
  app.get('/:guildId/audit-logs', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { limit = 50, before, userId: filterUserId, actionType } = request.query as {
      limit?: number; before?: string; userId?: string; actionType?: number
    }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const logs = await prisma.auditLog.findMany({
      where: {
        guildId,
        ...(filterUserId ? { userId: filterUserId } : {}),
        ...(actionType !== undefined ? { actionType: Number(actionType) } : {}),
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 100),
      include: { user: true },
    })

    return reply.send({
      auditLogEntries: logs.map((l) => ({
        id: l.id,
        guildId: l.guildId,
        userId: l.userId,
        targetId: l.targetId,
        actionType: l.actionType,
        changes: l.changes,
        options: l.options,
        reason: l.reason,
        createdAt: l.createdAt.toISOString(),
        user: l.user ? serializeUser(l.user) : null,
      })),
    })
  })

  // GET /guilds/:guildId/voice-states
  app.get('/:guildId/voice-states', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const voiceStates = await prisma.voiceState.findMany({
      where: { guildId },
    })

    return reply.send(voiceStates)
  })

  // ── Public Guild Join ───────────────────────────────────────────────────────

  // POST /guilds/:guildId/join — join a public guild directly
  app.post('/:guildId/join', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })
    if (!guild.isPublic) return reply.status(403).send({ code: 403, message: 'This guild is not public' })

    const existing = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (existing) return reply.status(200).send({ message: 'Already a member' })

    const everyoneRole = await prisma.role.findFirst({ where: { guildId, name: '@everyone' } })

    const member = await prisma.guildMember.create({
      data: {
        id: generateId(),
        guildId,
        userId: request.userId,
        roles: everyoneRole ? [everyoneRole.id] : [],
        permissions: '0',
      },
      include: { user: true },
    })

    await publishEvent({ type: 'GUILD_MEMBER_ADD', guildId, data: serializeGuildMember(member) })

    return reply.status(201).send(serializeGuildMember(member))
  })

  // ── Vanity URL ──────────────────────────────────────────────────────────────

  // GET /guilds/:guildId/vanity-url
  app.get('/:guildId/vanity-url', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    return reply.send({ code: guild.vanityCode, uses: 0 })
  })

  // PATCH /guilds/:guildId/vanity-url
  app.patch('/:guildId/vanity-url', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { code } = z.object({ code: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/).nullable() }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    if (code) {
      const existing = await prisma.guild.findFirst({ where: { vanityCode: code, id: { not: guildId } } })
      if (existing) return reply.status(400).send({ code: 400, message: 'Vanity URL already taken' })
    }

    const updated = await prisma.guild.update({ where: { id: guildId }, data: { vanityCode: code } })
    return reply.send({ code: updated.vanityCode })
  })

  // ── Scheduled Events ────────────────────────────────────────────────────────

  const serializeEvent = (e: any) => ({
    id: e.id, guildId: e.guildId, creatorId: e.creatorId,
    name: e.name, description: e.description,
    scheduledStartTime: e.scheduledStartTime instanceof Date ? e.scheduledStartTime.toISOString() : e.scheduledStartTime,
    scheduledEndTime: e.scheduledEndTime instanceof Date ? e.scheduledEndTime?.toISOString() : e.scheduledEndTime,
    privacyLevel: e.privacyLevel, status: e.status,
    entityType: e.entityType, entityId: e.entityId,
    entityMetadata: e.entityMetadata, image: e.image,
    userCount: e.userCount,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
  })

  // GET /guilds/:guildId/scheduled-events
  app.get('/:guildId/scheduled-events', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const events = await prisma.guildScheduledEvent.findMany({
      where: { guildId },
      orderBy: { scheduledStartTime: 'asc' },
    })
    return reply.send(events.map(serializeEvent))
  })

  // POST /guilds/:guildId/scheduled-events
  app.post('/:guildId/scheduled-events', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(1000).optional(),
      scheduledStartTime: z.string(),
      scheduledEndTime: z.string().optional(),
      privacyLevel: z.number().min(1).max(2).optional(),
      entityType: z.number().min(1).max(3).optional(),
      entityMetadata: z.object({ location: z.string().optional() }).optional(),
      image: z.string().optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(403).send({ code: 403, message: 'Missing access' })

    const event = await prisma.guildScheduledEvent.create({
      data: {
        id: generateId(), guildId, creatorId: request.userId,
        name: body.name, description: body.description,
        scheduledStartTime: new Date(body.scheduledStartTime),
        scheduledEndTime: body.scheduledEndTime ? new Date(body.scheduledEndTime) : null,
        privacyLevel: body.privacyLevel ?? 2,
        entityType: body.entityType ?? 3,
        entityMetadata: body.entityMetadata ?? {},
        image: body.image,
      },
    })

    await publishEvent({ type: 'GUILD_SCHEDULED_EVENT_CREATE', guildId, data: serializeEvent(event) })
    return reply.status(201).send(serializeEvent(event))
  })

  // PATCH /guilds/:guildId/scheduled-events/:eventId
  app.patch('/:guildId/scheduled-events/:eventId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, eventId } = request.params as { guildId: string; eventId: string }
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).nullable().optional(),
      scheduledStartTime: z.string().optional(),
      scheduledEndTime: z.string().nullable().optional(),
      status: z.number().min(1).max(4).optional(),
      entityMetadata: z.object({ location: z.string().optional() }).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const event = await prisma.guildScheduledEvent.findFirst({ where: { id: eventId, guildId } })
    if (!event) return reply.status(404).send({ code: 404, message: 'Unknown scheduled event' })

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.scheduledStartTime !== undefined) updateData.scheduledStartTime = new Date(body.scheduledStartTime)
    if (body.scheduledEndTime !== undefined) updateData.scheduledEndTime = body.scheduledEndTime ? new Date(body.scheduledEndTime) : null
    if (body.status !== undefined) updateData.status = body.status
    if (body.entityMetadata !== undefined) updateData.entityMetadata = body.entityMetadata

    const updated = await prisma.guildScheduledEvent.update({ where: { id: eventId }, data: updateData })
    await publishEvent({ type: 'GUILD_SCHEDULED_EVENT_UPDATE', guildId, data: serializeEvent(updated) })
    return reply.send(serializeEvent(updated))
  })

  // DELETE /guilds/:guildId/scheduled-events/:eventId
  app.delete('/:guildId/scheduled-events/:eventId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, eventId } = request.params as { guildId: string; eventId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const event = await prisma.guildScheduledEvent.findFirst({ where: { id: eventId, guildId } })
    if (!event) return reply.status(404).send({ code: 404, message: 'Unknown scheduled event' })

    await prisma.guildScheduledEvent.delete({ where: { id: eventId } })
    await publishEvent({ type: 'GUILD_SCHEDULED_EVENT_DELETE', guildId, data: { id: eventId, guildId } })
    return reply.status(204).send()
  })

  // ── Auto-Moderation ─────────────────────────────────────────────────────────

  // GET /guilds/:guildId/auto-moderation/rules
  app.get('/:guildId/auto-moderation/rules', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }
    const rules = await prisma.autoModRule.findMany({ where: { guildId } })
    return reply.send(rules)
  })

  // POST /guilds/:guildId/auto-moderation/rules
  app.post('/:guildId/auto-moderation/rules', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = z.object({
      name: z.string().min(1).max(100),
      eventType: z.number().optional(),
      triggerType: z.number().min(1).max(5),
      triggerMetadata: z.record(z.unknown()).optional(),
      actions: z.array(z.object({
        type: z.number(),
        metadata: z.record(z.unknown()).optional(),
      })).min(1),
      enabled: z.boolean().optional(),
      exemptRoles: z.array(z.string()).optional(),
      exemptChannels: z.array(z.string()).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const rule = await prisma.autoModRule.create({
      data: {
        id: generateId(), guildId, creatorId: request.userId,
        name: body.name, eventType: body.eventType ?? 1,
        triggerType: body.triggerType,
        triggerMetadata: (body.triggerMetadata ?? {}) as any,
        actions: body.actions as any,
        enabled: body.enabled ?? true,
        exemptRoles: body.exemptRoles ?? [],
        exemptChannels: body.exemptChannels ?? [],
      },
    })

    return reply.status(201).send(rule)
  })

  // PATCH /guilds/:guildId/auto-moderation/rules/:ruleId
  app.patch('/:guildId/auto-moderation/rules/:ruleId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, ruleId } = request.params as { guildId: string; ruleId: string }
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      enabled: z.boolean().optional(),
      actions: z.array(z.object({ type: z.number(), metadata: z.record(z.unknown()).optional() })).optional(),
      exemptRoles: z.array(z.string()).optional(),
      exemptChannels: z.array(z.string()).optional(),
      triggerMetadata: z.record(z.unknown()).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const rule = await prisma.autoModRule.findFirst({ where: { id: ruleId, guildId } })
    if (!rule) return reply.status(404).send({ code: 404, message: 'Unknown rule' })

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.enabled !== undefined) updateData.enabled = body.enabled
    if (body.actions !== undefined) updateData.actions = body.actions
    if (body.exemptRoles !== undefined) updateData.exemptRoles = body.exemptRoles
    if (body.exemptChannels !== undefined) updateData.exemptChannels = body.exemptChannels
    if (body.triggerMetadata !== undefined) updateData.triggerMetadata = body.triggerMetadata

    const updated = await prisma.autoModRule.update({ where: { id: ruleId }, data: updateData })
    return reply.send(updated)
  })

  // DELETE /guilds/:guildId/auto-moderation/rules/:ruleId
  app.delete('/:guildId/auto-moderation/rules/:ruleId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, ruleId } = request.params as { guildId: string; ruleId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const rule = await prisma.autoModRule.findFirst({ where: { id: ruleId, guildId } })
    if (!rule) return reply.status(404).send({ code: 404, message: 'Unknown rule' })

    await prisma.autoModRule.delete({ where: { id: ruleId } })
    return reply.status(204).send()
  })

  // ── Server Templates ────────────────────────────────────────────────────────

  // GET /guilds/templates/:code — resolve template (no auth)
  app.get('/templates/:code', async (request, reply) => {
    const { code } = request.params as { code: string }
    const template = await prisma.guildTemplate.findUnique({ where: { code } })
    if (!template) return reply.status(404).send({ code: 404, message: 'Unknown template' })
    return reply.send(template)
  })

  // GET /guilds/:guildId/templates — list guild templates
  app.get('/:guildId/templates', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }
    const templates = await prisma.guildTemplate.findMany({ where: { guildId } })
    return reply.send(templates)
  })

  // POST /guilds/:guildId/templates — create template from guild
  app.post('/:guildId/templates', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { name, description } = z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(120).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { channels: { orderBy: { position: 'asc' } }, roles: { orderBy: { position: 'asc' } } },
    })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const code = generateRandomString(10)
    const serializedGuild = {
      name: guild.name, icon: guild.icon, description: guild.description,
      verificationLevel: guild.verificationLevel,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      explicitContentFilter: guild.explicitContentFilter,
      channels: guild.channels.map(c => ({
        name: c.name, type: c.type, topic: c.topic, position: c.position,
        parentId: c.parentId, nsfw: c.nsfw,
      })),
      roles: guild.roles.filter(r => r.name !== '@everyone').map(r => ({
        name: r.name, color: r.color, hoist: r.hoist,
        mentionable: r.mentionable, permissions: r.permissions,
      })),
    }

    const template = await prisma.guildTemplate.create({
      data: { code, name, description, creatorId: request.userId, guildId, serializedGuild },
    })
    return reply.status(201).send(template)
  })

  // DELETE /guilds/:guildId/templates/:code
  app.delete('/:guildId/templates/:code', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, code } = request.params as { guildId: string; code: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild || guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const template = await prisma.guildTemplate.findFirst({ where: { code, guildId } })
    if (!template) return reply.status(404).send({ code: 404, message: 'Unknown template' })

    await prisma.guildTemplate.delete({ where: { code } })
    return reply.status(204).send()
  })
}
