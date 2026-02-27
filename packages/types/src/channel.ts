export enum ChannelType {
  GUILD_TEXT = 0,
  DM = 1,
  GUILD_VOICE = 2,
  GROUP_DM = 3,
  GUILD_CATEGORY = 4,
  GUILD_ANNOUNCEMENT = 5,
  PUBLIC_THREAD = 11,
  PRIVATE_THREAD = 12,
  GUILD_STAGE_VOICE = 13,
}

export interface PermissionOverwrite {
  id: string
  type: 0 | 1 // 0=role, 1=member
  allow: string
  deny: string
}

export interface Channel {
  id: string
  type: ChannelType
  guildId: string | null
  name: string | null
  topic: string | null
  position: number
  parentId: string | null
  nsfw: boolean
  slowmode: number
  lastMessageId: string | null
  lastPinTimestamp: string | null
  userLimit: number | null
  bitrate: number | null
  rtcRegion: string | null
  permissionOverwrites: PermissionOverwrite[]
  recipients?: import('./user').User[] // DMs
  icon?: string | null // Group DMs
  ownerId?: string | null // Group DMs / Threads
  threadMetadata?: ThreadMetadata | null
  memberCount?: number | null
  messageCount?: number | null
  createdAt: string
}

export interface ThreadMetadata {
  archived: boolean
  autoArchiveDuration: 60 | 1440 | 4320 | 10080
  archiveTimestamp: string
  locked: boolean
  invitable?: boolean
  createTimestamp?: string | null
}

export interface VoiceState {
  guildId: string | null
  channelId: string | null
  userId: string
  member?: import('./guild').GuildMember
  sessionId: string
  deaf: boolean
  mute: boolean
  selfDeaf: boolean
  selfMute: boolean
  selfStream: boolean
  selfVideo: boolean
  suppress: boolean
  requestToSpeakTimestamp: string | null
}

export interface ReadState {
  channelId: string
  lastMessageId: string | null
  lastPinTimestamp: string | null
  mentionCount: number
}
