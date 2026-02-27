import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { prisma } from '../../lib/prisma.js'
import { generateId } from '@freecord/snowflake'
import { publishEvent } from '../../lib/redis.js'
import { serializeUser } from '../../lib/serialize.js'

export default async function inviteRoutes(app: FastifyInstance) {
  // GET /:code - get invite info (public)
  app.get('/:code', async (request, reply) => {
    const { code } = request.params as { code: string }

    const invite = await prisma.guildInvite.findUnique({
      where: { code },
      include: {
        guild: {
          include: {
            emojis: true,
            _count: { select: { members: true } },
          },
        },
      },
    })

    if (!invite) return reply.status(404).send({ code: 404, message: 'Unknown invite' })
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return reply.status(404).send({ code: 404, message: 'Invite has expired' })
    }

    const channel = await prisma.channel.findUnique({ where: { id: invite.channelId } })

    return reply.send({
      code: invite.code,
      guild: {
        id: invite.guild.id,
        name: invite.guild.name,
        icon: invite.guild.icon,
        banner: invite.guild.banner,
        description: invite.guild.description,
        features: invite.guild.features,
        verificationLevel: invite.guild.verificationLevel,
        nsfwLevel: invite.guild.nsfwLevel,
        premiumSubscriptionCount: 0,
        approximateMemberCount: invite.guild._count.members,
      },
      channel: channel ? { id: channel.id, name: channel.name, type: 0 } : null,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      uses: invite.uses,
      maxUses: invite.maxUses,
      maxAge: invite.maxAge,
      temporary: invite.temporary,
      createdAt: invite.createdAt.toISOString(),
    })
  })

  // POST /:code - use/join invite
  app.post('/:code', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.params as { code: string }

    const invite = await prisma.guildInvite.findUnique({
      where: { code },
      include: { guild: { include: { roles: true } } },
    })

    if (!invite) return reply.status(404).send({ code: 404, message: 'Unknown invite' })
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return reply.status(404).send({ code: 404, message: 'Invite has expired' })
    }
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return reply.status(404).send({ code: 404, message: 'Invite has reached max uses' })
    }

    // Check if already a member
    const existing = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: invite.guildId, userId: request.userId } },
    })
    if (existing) {
      return reply.status(400).send({ code: 400, message: 'Already a member of this guild' })
    }

    // Check if banned
    const ban = await prisma.guildBan.findUnique({
      where: { guildId_userId: { guildId: invite.guildId, userId: request.userId } },
    })
    if (ban) return reply.status(403).send({ code: 403, message: 'You are banned from this guild' })

    const everyoneRole = invite.guild.roles.find((r) => r.name === '@everyone')

    const member = await prisma.$transaction(async (tx) => {
      const m = await tx.guildMember.create({
        data: {
          id: generateId(),
          guildId: invite.guildId,
          userId: request.userId,
          roles: everyoneRole ? [everyoneRole.id] : [],
        },
        include: { user: true },
      })

      await tx.guildInvite.update({
        where: { code },
        data: { uses: { increment: 1 } },
      })

      await tx.guild.update({
        where: { id: invite.guildId },
        data: { memberCount: { increment: 1 } },
      })

      return m
    })

    // Get full guild data
    const guild = await prisma.guild.findUnique({
      where: { id: invite.guildId },
      include: {
        channels: { orderBy: { position: 'asc' } },
        roles: { orderBy: { position: 'asc' } },
        emojis: true,
        members: { include: { user: true }, take: 100 },
      },
    })

    await publishEvent({
      type: 'GUILD_MEMBER_ADD',
      guildId: invite.guildId,
      data: {
        guildId: invite.guildId,
        user: serializeUser(member.user),
        roles: member.roles,
        joinedAt: member.joinedAt.toISOString(),
        guild,
      },
    })

    return reply.send(guild)
  })

  // DELETE /:code - delete invite
  app.delete('/:code', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.params as { code: string }

    const invite = await prisma.guildInvite.findUnique({ where: { code } })
    if (!invite) return reply.status(404).send({ code: 404, message: 'Unknown invite' })

    // Must be a member to delete invite (owner or MANAGE_GUILD)
    const guild = await prisma.guild.findUnique({ where: { id: invite.guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: invite.guildId, userId: request.userId } },
    })
    if (!member || guild.ownerId !== request.userId) {
      // Also allow the invite creator to delete their own invite
      if (invite.inviterId !== request.userId) {
        return reply.status(403).send({ code: 403, message: 'Missing permissions' })
      }
    }

    await prisma.guildInvite.delete({ where: { code } })

    await publishEvent({
      type: 'INVITE_DELETE',
      guildId: invite.guildId,
      data: { code, guildId: invite.guildId, channelId: invite.channelId },
    })

    return reply.status(204).send()
  })
}
