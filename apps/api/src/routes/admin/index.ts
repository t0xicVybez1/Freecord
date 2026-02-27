import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { prisma } from '../../lib/prisma.js'
import { publishEvent } from '../../lib/redis.js'
import { serializeUser } from '../../lib/serialize.js'

// Admin-only middleware
async function requireStaff(request: any, reply: any) {
  await authenticate(request, reply)
  if (reply.sent) return

  const user = await prisma.user.findUnique({ where: { id: request.userId } })
  if (!user?.isStaff) {
    return reply.status(403).send({ code: 403, message: 'Forbidden: staff only' })
  }
}

export default async function adminRoutes(app: FastifyInstance) {
  // ── Stats ──────────────────────────────────────────────────────────────────

  // GET /admin/stats — platform-wide statistics
  app.get('/stats', { preHandler: requireStaff }, async (_request, reply) => {
    const [totalUsers, totalGuilds, totalMessages, totalChannels, onlineUsers] = await Promise.all([
      prisma.user.count(),
      prisma.guild.count(),
      prisma.message.count({ where: { deletedAt: null } }),
      prisma.channel.count(),
      prisma.user.count({ where: { status: { not: 'OFFLINE' } } }),
    ])

    const newUsersToday = await prisma.user.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    })
    const newGuildsToday = await prisma.guild.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    })

    return reply.send({
      totalUsers,
      totalGuilds,
      totalMessages,
      totalChannels,
      onlineUsers,
      newUsersToday,
      newGuildsToday,
    })
  })

  // ── Users ──────────────────────────────────────────────────────────────────

  // GET /admin/users — list all users with search + pagination
  app.get('/users', { preHandler: requireStaff }, async (request, reply) => {
    const { q = '', limit = 50, offset = 0 } = request.query as {
      q?: string; limit?: number; offset?: number
    }
    const take = Math.min(Number(limit), 200)
    const skip = Number(offset)

    const where = q.trim()
      ? {
          OR: [
            { username: { contains: q.trim(), mode: 'insensitive' as const } },
            { email: { contains: q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ])

    return reply.send({
      users: users.map(u => serializeUser(u, false, true)),
      total,
    })
  })

  // GET /admin/users/:userId — single user detail
  app.get('/users/:userId', { preHandler: requireStaff }, async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })

    const [guildCount, messageCount, sessionCount] = await Promise.all([
      prisma.guildMember.count({ where: { userId } }),
      prisma.message.count({ where: { authorId: userId, deletedAt: null } }),
      prisma.session.count({ where: { userId } }),
    ])

    return reply.send({
      ...serializeUser(user, false, true),
      guildCount,
      messageCount,
      sessionCount,
    })
  })

  // PATCH /admin/users/:userId — modify user (ban, staff toggle, etc.)
  app.patch('/users/:userId', { preHandler: requireStaff }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    const body = z.object({
      isStaff: z.boolean().optional(),
      verified: z.boolean().optional(),
      // Soft-ban: set a flag in flags field (bit 2 = banned)
      banned: z.boolean().optional(),
      username: z.string().min(2).max(32).optional(),
    }).parse(request.body)

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })

    const updateData: Record<string, unknown> = {}
    if (body.isStaff !== undefined) updateData.isStaff = body.isStaff
    if (body.verified !== undefined) updateData.verified = body.verified
    if (body.username !== undefined) updateData.username = body.username
    if (body.banned !== undefined) {
      // Use flags bit 2 (value 4) as banned indicator
      const currentFlags = user.flags ?? 0
      updateData.flags = body.banned ? (currentFlags | 4) : (currentFlags & ~4)
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: updateData })

    // If banned, invalidate all sessions
    if (body.banned) {
      await prisma.session.deleteMany({ where: { userId } })
    }

    return reply.send(serializeUser(updated, false, true))
  })

  // DELETE /admin/users/:userId — permanently delete a user account
  app.delete('/users/:userId', { preHandler: requireStaff }, async (request, reply) => {
    const { userId } = request.params as { userId: string }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })

    // Cannot delete another staff member
    if (user.isStaff) {
      return reply.status(403).send({ code: 403, message: 'Cannot delete staff accounts' })
    }

    // Delete sessions first, then user (cascades via Prisma)
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })

    return reply.status(204).send()
  })

  // POST /admin/users/:userId/kick-sessions — force logout
  app.post('/users/:userId/kick-sessions', { preHandler: requireStaff }, async (request, reply) => {
    const { userId } = request.params as { userId: string }
    await prisma.session.deleteMany({ where: { userId } })
    return reply.status(204).send()
  })

  // ── Guilds ─────────────────────────────────────────────────────────────────

  // GET /admin/guilds — list all guilds
  app.get('/guilds', { preHandler: requireStaff }, async (request, reply) => {
    const { q = '', limit = 50, offset = 0 } = request.query as {
      q?: string; limit?: number; offset?: number
    }
    const take = Math.min(Number(limit), 200)
    const skip = Number(offset)

    const where = q.trim()
      ? { name: { contains: q.trim(), mode: 'insensitive' as const } }
      : {}

    const [guilds, total] = await Promise.all([
      prisma.guild.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: { owner: true, _count: { select: { members: true, channels: true } } },
      }),
      prisma.guild.count({ where }),
    ])

    return reply.send({
      guilds: guilds.map(g => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        description: g.description,
        memberCount: g._count.members,
        channelCount: g._count.channels,
        ownerId: g.ownerId,
        ownerUsername: g.owner.username,
        createdAt: g.createdAt.toISOString(),
      })),
      total,
    })
  })

  // GET /admin/guilds/:guildId — single guild detail
  app.get('/guilds/:guildId', { preHandler: requireStaff }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        owner: true,
        _count: { select: { members: true, channels: true, messages: false } },
        channels: { take: 50, orderBy: { position: 'asc' } },
      },
    })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Guild not found' })

    const messageCount = await prisma.message.count({
      where: { channel: { guildId }, deletedAt: null },
    })

    return reply.send({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      banner: guild.banner,
      description: guild.description,
      ownerId: guild.ownerId,
      ownerUsername: guild.owner.username,
      memberCount: guild._count.members,
      channelCount: guild._count.channels,
      messageCount,
      verificationLevel: guild.verificationLevel,
      createdAt: guild.createdAt.toISOString(),
      channels: guild.channels.map(c => ({ id: c.id, name: c.name, type: c.type })),
    })
  })

  // DELETE /admin/guilds/:guildId — delete a guild
  app.delete('/guilds/:guildId', { preHandler: requireStaff }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Guild not found' })

    await prisma.guild.delete({ where: { id: guildId } })

    await publishEvent({
      type: 'GUILD_DELETE',
      guildId,
      data: { id: guildId, unavailable: true },
    })

    return reply.status(204).send()
  })

  // PATCH /admin/guilds/:guildId — update guild (e.g., remove NSFW content, rename)
  app.patch('/guilds/:guildId', { preHandler: requireStaff }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const body = z.object({
      name: z.string().min(2).max(100).optional(),
      description: z.string().max(120).nullable().optional(),
      features: z.array(z.string()).optional(),
    }).parse(request.body)

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Guild not found' })

    const updated = await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.features !== undefined && { features: body.features }),
      },
    })

    await publishEvent({
      type: 'GUILD_UPDATE',
      guildId,
      data: { id: updated.id, name: updated.name, icon: updated.icon, description: updated.description },
    })

    return reply.send({ id: updated.id, name: updated.name })
  })

  // ── Messages ───────────────────────────────────────────────────────────────

  // DELETE /admin/messages/:messageId — delete any message
  app.delete('/messages/:messageId', { preHandler: requireStaff }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string }

    const message = await prisma.message.findFirst({ where: { id: messageId, deletedAt: null } })
    if (!message) return reply.status(404).send({ code: 404, message: 'Message not found' })

    await prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } })

    await publishEvent({
      type: 'MESSAGE_DELETE',
      channelId: message.channelId,
      data: { id: messageId, channelId: message.channelId },
    })

    return reply.status(204).send()
  })

  // ── Audit Log ──────────────────────────────────────────────────────────────

  // GET /admin/audit-log — platform-wide audit log
  app.get('/audit-log', { preHandler: requireStaff }, async (request, reply) => {
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number }
    const take = Math.min(Number(limit), 200)

    const entries = await prisma.auditLog.findMany({
      take,
      skip: Number(offset),
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    })

    return reply.send(entries.map(e => ({
      id: e.id,
      guildId: e.guildId,
      userId: e.userId,
      username: e.user?.username,
      actionType: e.actionType,
      targetId: e.targetId,
      changes: e.changes,
      reason: e.reason,
      createdAt: e.createdAt.toISOString(),
    })))
  })
}
