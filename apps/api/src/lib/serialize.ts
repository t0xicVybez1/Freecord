import type { User, Guild, Channel, GuildMember, Role, Message, MessageReaction, DirectMessageMember } from '@prisma/client'

// Serialize user for public consumption
export function serializeUser(user: User & { isStaff?: boolean }, isSelf = false, isAdmin = false) {
  const base = {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    avatar: user.avatar,
    banner: user.banner,
    bio: user.bio,
    accentColor: user.accentColor,
    status: user.status.toLowerCase(),
    customStatus: user.customStatus,
    flags: user.flags,
    bot: user.bot,
    system: user.system,
    verified: user.verified,
    isStaff: user.isStaff ?? false,
    mfaEnabled: user.twoFactorEnabled,
    locale: user.locale,
    createdAt: user.createdAt.toISOString(),
  }

  if (isSelf || isAdmin) {
    return {
      ...base,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
    }
  }

  return base
}

export function serializeGuildMember(member: GuildMember & { user: User }) {
  return {
    user: serializeUser(member.user),
    guildId: member.guildId,
    nickname: member.nickname,
    avatar: member.avatar,
    roles: member.roles,
    joinedAt: member.joinedAt.toISOString(),
    premiumSince: member.premiumSince?.toISOString() ?? null,
    deaf: member.deaf,
    mute: member.mute,
    pending: member.pending,
    permissions: member.permissions,
  }
}

export function serializeRole(role: Role) {
  return {
    id: role.id,
    guildId: role.guildId,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    icon: role.icon,
    unicodeEmoji: role.unicodeEmoji,
    position: role.position,
    permissions: role.permissions,
    managed: role.managed,
    mentionable: role.mentionable,
    tags: role.tags,
  }
}

export function serializeChannel(
  channel: Channel & {
    dmMembers?: (DirectMessageMember & { user: User })[]
  }
) {
  return {
    id: channel.id,
    type: channelTypeToNumber(channel.type as string),
    guildId: channel.guildId,
    name: channel.name,
    topic: channel.topic,
    position: channel.position,
    parentId: channel.parentId,
    nsfw: channel.nsfw,
    slowmode: channel.slowmode,
    lastMessageId: channel.lastMessageId,
    lastPinTimestamp: channel.lastPinTimestamp?.toISOString() ?? null,
    userLimit: channel.userLimit,
    bitrate: channel.bitrate,
    rtcRegion: channel.rtcRegion,
    permissionOverwrites: channel.permissionOverwrites as unknown[],
    ownerId: channel.ownerId,
    icon: channel.icon,
    threadMetadata: channel.threadMetadata,
    memberCount: channel.memberCount,
    messageCount: channel.messageCount,
    recipients: channel.dmMembers?.map((m) => serializeUser(m.user)) ?? undefined,
    createdAt: channel.createdAt.toISOString(),
  }
}

function channelTypeToNumber(type: string): number {
  const map: Record<string, number> = {
    GUILD_TEXT: 0,
    DM: 1,
    GUILD_VOICE: 2,
    GROUP_DM: 3,
    GUILD_CATEGORY: 4,
    GUILD_ANNOUNCEMENT: 5,
    PUBLIC_THREAD: 11,
    PRIVATE_THREAD: 12,
    GUILD_STAGE_VOICE: 13,
  }
  return map[type] ?? 0
}

export function serializeMessage(
  msg: Message & {
    author?: User | null
    reactions?: (MessageReaction & { user?: User })[]
    referencedMessage?: (Message & { author?: User | null }) | null
  },
  currentUserId?: string
) {
  const reactions = msg.reactions ? groupReactions(msg.reactions, currentUserId) : []

  const referencedMessage = msg.referencedMessage
    ? {
        id: msg.referencedMessage.id,
        channelId: msg.referencedMessage.channelId,
        author: msg.referencedMessage.author ? serializeUser(msg.referencedMessage.author) : null,
        content: msg.referencedMessage.content,
        type: messageTypeToNumber(msg.referencedMessage.type as string),
        attachments: msg.referencedMessage.attachments as unknown[],
        embeds: msg.referencedMessage.embeds as unknown[],
        flags: msg.referencedMessage.flags,
        editedAt: msg.referencedMessage.editedAt?.toISOString() ?? null,
        createdAt: msg.referencedMessage.createdAt.toISOString(),
      }
    : null

  return {
    id: msg.id,
    channelId: msg.channelId,
    author: msg.author ? serializeUser(msg.author) : null,
    webhookId: msg.webhookId,
    content: msg.content,
    type: messageTypeToNumber(msg.type as string),
    pinned: msg.pinned,
    tts: msg.tts,
    mentionEveryone: msg.mentionEveryone,
    mentions: msg.mentions,
    mentionRoles: msg.mentionRoles,
    mentionChannels: msg.mentionChannels,
    attachments: msg.attachments as unknown[],
    embeds: msg.embeds as unknown[],
    reactions,
    flags: msg.flags,
    referencedMessage,
    editedAt: msg.editedAt?.toISOString() ?? null,
    createdAt: msg.createdAt.toISOString(),
  }
}

function messageTypeToNumber(type: string): number {
  const map: Record<string, number> = {
    DEFAULT: 0,
    RECIPIENT_ADD: 1,
    RECIPIENT_REMOVE: 2,
    CALL: 3,
    CHANNEL_NAME_CHANGE: 4,
    CHANNEL_ICON_CHANGE: 5,
    CHANNEL_PINNED_MESSAGE: 6,
    GUILD_MEMBER_JOIN: 7,
    REPLY: 19,
    APPLICATION_COMMAND: 20,
    THREAD_CREATED: 18,
    THREAD_STARTER_MESSAGE: 21,
  }
  return map[type] ?? 0
}

function groupReactions(
  reactions: (MessageReaction & { user?: User })[],
  currentUserId?: string
) {
  const grouped: Record<
    string,
    { count: number; me: boolean; emoji: { id: string | null; name: string | null; animated: boolean } }
  > = {}

  for (const reaction of reactions) {
    if (!grouped[reaction.emoji]) {
      grouped[reaction.emoji] = {
        count: 0,
        me: false,
        emoji: {
          id: reaction.emoji.match(/^\d+$/) ? reaction.emoji : null,
          name: reaction.emojiName || reaction.emoji,
          animated: reaction.animated,
        },
      }
    }
    grouped[reaction.emoji].count++
    if (currentUserId && reaction.userId === currentUserId) {
      grouped[reaction.emoji].me = true
    }
  }

  return Object.values(grouped)
}
