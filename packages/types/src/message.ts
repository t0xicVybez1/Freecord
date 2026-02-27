export enum MessageType {
  DEFAULT = 0,
  RECIPIENT_ADD = 1,
  RECIPIENT_REMOVE = 2,
  CALL = 3,
  CHANNEL_NAME_CHANGE = 4,
  CHANNEL_ICON_CHANGE = 5,
  CHANNEL_PINNED_MESSAGE = 6,
  GUILD_MEMBER_JOIN = 7,
  REPLY = 19,
  APPLICATION_COMMAND = 20,
  THREAD_CREATED = 18,
  THREAD_STARTER_MESSAGE = 21,
}

export enum MessageFlags {
  CROSSPOSTED = 1 << 0,
  IS_CROSSPOST = 1 << 1,
  SUPPRESS_EMBEDS = 1 << 2,
  SOURCE_MESSAGE_DELETED = 1 << 3,
  URGENT = 1 << 4,
  HAS_THREAD = 1 << 5,
  EPHEMERAL = 1 << 6,
  LOADING = 1 << 7,
  FAILED_TO_MENTION_SOME_ROLES_IN_THREAD = 1 << 8,
}

export interface Message {
  id: string
  channelId: string
  author: import('./user').User | null
  webhookId: string | null
  content: string
  type: MessageType
  pinned: boolean
  tts: boolean
  mentionEveryone: boolean
  mentions: import('./user').User[]
  mentionRoles: string[]
  mentionChannels: MentionedChannel[]
  attachments: MessageAttachment[]
  embeds: MessageEmbed[]
  reactions: MessageReaction[]
  flags: number
  referencedMessage: Message | null
  thread?: import('./channel').Channel
  editedAt: string | null
  createdAt: string
}

export interface MessageAttachment {
  id: string
  filename: string
  description?: string
  contentType?: string
  size: number
  url: string
  proxyUrl: string
  height?: number | null
  width?: number | null
  ephemeral?: boolean
}

export interface MessageEmbed {
  title?: string
  type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link'
  description?: string
  url?: string
  timestamp?: string
  color?: number
  footer?: { text: string; iconUrl?: string }
  image?: { url: string; height?: number; width?: number }
  thumbnail?: { url: string; height?: number; width?: number }
  video?: { url?: string; height?: number; width?: number }
  provider?: { name?: string; url?: string }
  author?: { name: string; url?: string; iconUrl?: string }
  fields?: { name: string; value: string; inline?: boolean }[]
}

export interface MessageReaction {
  count: number
  me: boolean
  emoji: ReactionEmoji
}

export interface ReactionEmoji {
  id: string | null
  name: string | null
  animated?: boolean
}

export interface MentionedChannel {
  id: string
  guildId: string
  type: import('./channel').ChannelType
  name: string
}
