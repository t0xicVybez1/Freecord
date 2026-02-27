import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middleware/authenticate.js'
import { prisma } from '../../lib/prisma.js'
import { publishEvent } from '../../lib/redis.js'
import { generateId } from '@freecord/snowflake'

export default async function voiceRoutes(app: FastifyInstance) {
  // GET /regions - get available voice regions
  app.get('/regions', async (request, reply) => {
    return reply.send([
      { id: 'us-west', name: 'US West', optimal: true, deprecated: false, custom: false },
      { id: 'us-east', name: 'US East', optimal: false, deprecated: false, custom: false },
      { id: 'eu-west', name: 'EU West', optimal: false, deprecated: false, custom: false },
    ])
  })

  // PATCH /guilds/:guildId/voice-states/@me - join/leave/update voice channel
  app.patch('/guilds/:guildId/voice-states/@me', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }
    const { channelId, suppress, requestToSpeakTimestamp } = (request.body as {
      channelId?: string | null
      suppress?: boolean
      requestToSpeakTimestamp?: string | null
    }) || {}

    const member = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: request.userId } },
    })
    if (!member) return reply.status(404).send({ code: 404, message: 'Not a member' })

    const existing = await prisma.voiceState.findUnique({ where: { userId: request.userId } })

    if (channelId === null || channelId === undefined) {
      // Leave voice
      if (existing) {
        const prevChannelId = existing.channelId
        await prisma.voiceState.delete({ where: { userId: request.userId } })
        await publishEvent({
          type: 'VOICE_STATE_UPDATE',
          guildId,
          data: {
            userId: request.userId,
            guildId,
            channelId: null,
            selfDeaf: false,
            selfMute: false,
            selfStream: false,
            selfVideo: false,
            deaf: false,
            mute: false,
            suppress: false,
            requestToSpeakTimestamp: null,
            sessionId: '',
          },
        })
      }
      return reply.status(204).send()
    }

    // Validate the channel exists and belongs to this guild
    const channel = await prisma.channel.findFirst({
      where: { id: channelId, guildId, type: { in: ['GUILD_VOICE', 'GUILD_STAGE_VOICE'] } },
    })
    if (!channel) {
      return reply.status(404).send({ code: 404, message: 'Unknown voice channel' })
    }

    const sessionId = existing?.sessionId || generateId()

    const voiceState = await prisma.voiceState.upsert({
      where: { userId: request.userId },
      create: {
        id: generateId(),
        userId: request.userId,
        guildId,
        channelId,
        memberId: member.id,
        sessionId,
        suppress: suppress ?? false,
        requestToSpeakAt: requestToSpeakTimestamp ? new Date(requestToSpeakTimestamp) : null,
      },
      update: {
        channelId,
        guildId,
        suppress: suppress ?? false,
        requestToSpeakAt: requestToSpeakTimestamp ? new Date(requestToSpeakTimestamp) : null,
      },
    })

    await publishEvent({
      type: 'VOICE_STATE_UPDATE',
      guildId,
      data: {
        userId: request.userId,
        guildId,
        channelId,
        sessionId: voiceState.sessionId,
        deaf: voiceState.deaf,
        mute: voiceState.mute,
        selfDeaf: voiceState.selfDeaf,
        selfMute: voiceState.selfMute,
        selfStream: voiceState.selfStream,
        selfVideo: voiceState.selfVideo,
        suppress: voiceState.suppress,
        requestToSpeakTimestamp: voiceState.requestToSpeakAt?.toISOString() ?? null,
      },
    })

    // Tell the specific client which voice server to connect to
    await publishEvent({
      type: 'VOICE_SERVER_UPDATE',
      userId: request.userId,
      data: {
        token: voiceState.sessionId,
        guildId,
        endpoint:
          process.env.VOICE_ENDPOINT ||
          `${process.env.VOICE_HOST || 'localhost'}:${process.env.VOICE_PORT || '8081'}`,
      },
    })

    return reply.status(204).send()
  })

  // PATCH /guilds/:guildId/voice-states/:userId - update another user's voice state (stage channels)
  app.patch('/guilds/:guildId/voice-states/:userId', { preHandler: authenticate }, async (request, reply) => {
    const { guildId, userId } = request.params as { guildId: string; userId: string }
    const { suppress, channelId } = (request.body as {
      suppress?: boolean
      channelId?: string
    }) || {}

    const guild = await prisma.guild.findUnique({ where: { id: guildId } })
    if (!guild) return reply.status(404).send({ code: 404, message: 'Unknown guild' })

    // Only owner or someone with appropriate permissions can modify others
    if (guild.ownerId !== request.userId) {
      return reply.status(403).send({ code: 403, message: 'Missing permissions' })
    }

    const targetState = await prisma.voiceState.findUnique({ where: { userId } })
    if (!targetState) return reply.status(404).send({ code: 404, message: 'User not in voice' })

    const updateData: Record<string, unknown> = {}
    if (suppress !== undefined) updateData.suppress = suppress
    if (channelId !== undefined) updateData.channelId = channelId

    const updated = await prisma.voiceState.update({
      where: { userId },
      data: updateData,
    })

    await publishEvent({
      type: 'VOICE_STATE_UPDATE',
      guildId,
      data: {
        userId,
        guildId,
        channelId: updated.channelId,
        sessionId: updated.sessionId,
        deaf: updated.deaf,
        mute: updated.mute,
        selfDeaf: updated.selfDeaf,
        selfMute: updated.selfMute,
        selfStream: updated.selfStream,
        selfVideo: updated.selfVideo,
        suppress: updated.suppress,
        requestToSpeakTimestamp: updated.requestToSpeakAt?.toISOString() ?? null,
      },
    })

    return reply.status(204).send()
  })

  // GET /guilds/:guildId/voice-states/@me
  app.get('/guilds/:guildId/voice-states/@me', { preHandler: authenticate }, async (request, reply) => {
    const { guildId } = request.params as { guildId: string }

    const voiceState = await prisma.voiceState.findFirst({
      where: { userId: request.userId, guildId },
    })

    if (!voiceState) {
      return reply.status(404).send({ code: 404, message: 'Not in a voice channel' })
    }

    return reply.send({
      userId: voiceState.userId,
      guildId: voiceState.guildId,
      channelId: voiceState.channelId,
      sessionId: voiceState.sessionId,
      deaf: voiceState.deaf,
      mute: voiceState.mute,
      selfDeaf: voiceState.selfDeaf,
      selfMute: voiceState.selfMute,
      selfStream: voiceState.selfStream,
      selfVideo: voiceState.selfVideo,
      suppress: voiceState.suppress,
      requestToSpeakTimestamp: voiceState.requestToSpeakAt?.toISOString() ?? null,
    })
  })
}
