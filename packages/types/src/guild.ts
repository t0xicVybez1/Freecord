export interface Guild {
  id: string
  name: string
  icon: string | null
  banner: string | null
  splash: string | null
  description: string | null
  ownerId: string
  systemChannelId: string | null
  rulesChannelId: string | null
  afkChannelId: string | null
  afkTimeout: number
  verificationLevel: 0 | 1 | 2 | 3 | 4
  defaultMessageNotifications: 0 | 1
  explicitContentFilter: 0 | 1 | 2
  mfaLevel: 0 | 1
  nsfwLevel: 0 | 1 | 2 | 3
  preferredLocale: string
  features: string[]
  large: boolean
  memberCount: number
  maxMembers: number
  channels?: import('./channel').Channel[]
  members?: GuildMember[]
  roles: Role[]
  emojis: GuildEmoji[]
  createdAt: string
}

export interface GuildPreview {
  id: string
  name: string
  icon: string | null
  banner: string | null
  description: string | null
  features: string[]
  approximateMemberCount: number
  approximatePresenceCount: number
  emojis: GuildEmoji[]
}

export interface GuildMember {
  user: import('./user').User
  guildId: string
  nickname: string | null
  avatar: string | null
  roles: string[]
  joinedAt: string
  premiumSince: string | null
  deaf: boolean
  mute: boolean
  pending: boolean
  permissions?: string
}

export interface Role {
  id: string
  guildId: string
  name: string
  color: number
  hoist: boolean
  icon: string | null
  unicodeEmoji: string | null
  position: number
  permissions: string
  managed: boolean
  mentionable: boolean
  tags?: {
    botId?: string
    integrationId?: string
    premiumSubscriberRole?: boolean
  }
}

export interface GuildEmoji {
  id: string
  name: string
  roles: string[]
  user?: import('./user').User
  requireColons: boolean
  managed: boolean
  animated: boolean
  available: boolean
}

export interface GuildBan {
  reason: string | null
  user: import('./user').User
}

export interface GuildInvite {
  code: string
  guild?: Partial<Guild>
  channel: Partial<import('./channel').Channel> | null
  inviter?: import('./user').User
  targetType?: number
  targetUser?: import('./user').User
  approximatePresenceCount?: number
  approximateMemberCount?: number
  expiresAt: string | null
  uses: number
  maxUses: number
  maxAge: number
  temporary: boolean
  createdAt: string
}

export interface AuditLog {
  id: string
  guildId: string
  userId: string | null
  targetId: string | null
  actionType: AuditLogAction
  changes: AuditLogChange[] | null
  options: Record<string, string> | null
  reason: string | null
  createdAt: string
  user?: import('./user').User
}

export enum AuditLogAction {
  GUILD_UPDATE = 1,
  CHANNEL_CREATE = 10,
  CHANNEL_UPDATE = 11,
  CHANNEL_DELETE = 12,
  CHANNEL_OVERWRITE_CREATE = 13,
  CHANNEL_OVERWRITE_UPDATE = 14,
  CHANNEL_OVERWRITE_DELETE = 15,
  MEMBER_KICK = 20,
  MEMBER_PRUNE = 21,
  MEMBER_BAN_ADD = 22,
  MEMBER_BAN_REMOVE = 23,
  MEMBER_UPDATE = 24,
  MEMBER_ROLE_UPDATE = 25,
  MEMBER_MOVE = 26,
  MEMBER_DISCONNECT = 27,
  BOT_ADD = 28,
  ROLE_CREATE = 30,
  ROLE_UPDATE = 31,
  ROLE_DELETE = 32,
  INVITE_CREATE = 40,
  INVITE_UPDATE = 41,
  INVITE_DELETE = 42,
  WEBHOOK_CREATE = 50,
  WEBHOOK_UPDATE = 51,
  WEBHOOK_DELETE = 52,
  EMOJI_CREATE = 60,
  EMOJI_UPDATE = 61,
  EMOJI_DELETE = 62,
  MESSAGE_DELETE = 72,
  MESSAGE_BULK_DELETE = 73,
  MESSAGE_PIN = 74,
  MESSAGE_UNPIN = 75,
}

export interface AuditLogChange {
  key: string
  oldValue?: unknown
  newValue?: unknown
}

export interface Webhook {
  id: string
  type: 1 | 2 | 3
  guildId: string | null
  channelId: string
  user?: import('./user').User
  name: string
  avatar: string | null
  token?: string
  applicationId: string | null
}
