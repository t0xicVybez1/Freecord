import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { serializeUser, serializeChannel } from '../../lib/serialize.js'

// Internal endpoints for Gateway to fetch user data
export default async function internalRoutes(app: FastifyInstance) {
  // Authenticate internal requests
  app.addHook('preHandler', async (request, reply) => {
    const token = request.headers['x-internal-token']
    if (token !== (process.env.INTERNAL_SECRET || 'internal-secret')) {
      return reply.status(401).send({ code: 401, message: 'Unauthorized' })
    }
  })

  // Get user ready data (for gateway IDENTIFY)
  app.get('/users/@me/ready', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string
    if (!userId) return reply.status(400).send({ code: 400, message: 'Missing user ID' })

    const [user, members, dmChannels, relationships, readStates, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.guildMember.findMany({
        where: { userId },
        include: {
          guild: {
            include: {
              channels: true,
              roles: true,
              emojis: true,
              members: { include: { user: true }, take: 100 },
            },
          },
        },
      }),
      prisma.directMessageMember.findMany({
        where: { userId },
        include: {
          channel: {
            include: {
              dmMembers: { include: { user: true } },
            },
          },
        },
      }),
      prisma.relationship.findMany({
        where: { userId },
        include: { target: true },
      }),
      prisma.readState.findMany({ where: { userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
    ])

    if (!user) return reply.status(404).send({ code: 404, message: 'User not found' })

    return reply.send({
      user: serializeUser(user, true),
      guilds: members.map((m) => ({
        ...m.guild,
        channels: m.guild.channels.map((c) => serializeChannel(c)),
        members: m.guild.members.map((gm) => ({
          ...gm,
          user: serializeUser(gm.user),
          guildId: m.guild.id,
        })),
      })),
      dmChannels: dmChannels.map((dm) => serializeChannel(dm.channel as any)),
      relationships: relationships.map((r) => ({
        id: r.id,
        type: r.type,
        user: serializeUser(r.target),
        createdAt: r.createdAt.toISOString(),
      })),
      readStates: readStates.map((rs) => ({
        channelId: rs.channelId,
        lastMessageId: rs.lastMessageId,
        mentionCount: rs.mentionCount,
        lastPinTimestamp: rs.lastPinTimestamp?.toISOString() ?? null,
      })),
      userSettings: settings || {},
    })
  })
}
