export enum GatewayOpcode {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  PRESENCE_UPDATE = 3,
  VOICE_STATE_UPDATE = 4,
  RESUME = 6,
  RECONNECT = 7,
  REQUEST_GUILD_MEMBERS = 8,
  INVALID_SESSION = 9,
  HELLO = 10,
  HEARTBEAT_ACK = 11,
}

export enum GatewayCloseCodes {
  UNKNOWN_ERROR = 4000,
  UNKNOWN_OPCODE = 4001,
  DECODE_ERROR = 4002,
  NOT_AUTHENTICATED = 4003,
  AUTHENTICATION_FAILED = 4004,
  ALREADY_AUTHENTICATED = 4005,
  INVALID_SEQ = 4007,
  RATE_LIMITED = 4008,
  SESSION_TIMED_OUT = 4009,
  INVALID_SHARD = 4010,
  SHARDING_REQUIRED = 4011,
  INVALID_API_VERSION = 4012,
  INVALID_INTENTS = 4013,
  DISALLOWED_INTENTS = 4014,
}

export interface GatewayPayload {
  op: GatewayOpcode
  d: unknown
  s: number | null
  t: string | null
}

export interface GatewayIdentify {
  token: string
  properties: {
    os: string
    browser: string
    device: string
  }
  compress?: boolean
  presence?: GatewayPresenceUpdate
}

export interface GatewayPresenceUpdate {
  since: number | null
  activities: import('./user').Activity[]
  status: import('./user').UserStatus
  afk: boolean
}

export interface GatewayVoiceStateUpdate {
  guildId: string | null
  channelId: string | null
  selfMute: boolean
  selfDeaf: boolean
}

export interface GatewayReadyData {
  v: number
  user: import('./user').PrivateUser
  guilds: import('./guild').Guild[]
  sessionId: string
  resumeGatewayUrl: string
  readState: import('./channel').ReadState[]
  relationships: import('./user').Relationship[]
  privateChannels: import('./channel').Channel[]
  presences: import('./user').PresenceUpdate[]
  userSettings: import('./user').UserSettings
}

// Server -> Client dispatch event names
export type GatewayDispatchEventName =
  | 'READY'
  | 'RESUMED'
  | 'GUILD_CREATE'
  | 'GUILD_UPDATE'
  | 'GUILD_DELETE'
  | 'GUILD_MEMBER_ADD'
  | 'GUILD_MEMBER_UPDATE'
  | 'GUILD_MEMBER_REMOVE'
  | 'GUILD_MEMBERS_CHUNK'
  | 'GUILD_ROLE_CREATE'
  | 'GUILD_ROLE_UPDATE'
  | 'GUILD_ROLE_DELETE'
  | 'GUILD_BAN_ADD'
  | 'GUILD_BAN_REMOVE'
  | 'GUILD_EMOJIS_UPDATE'
  | 'CHANNEL_CREATE'
  | 'CHANNEL_UPDATE'
  | 'CHANNEL_DELETE'
  | 'CHANNEL_PINS_UPDATE'
  | 'THREAD_CREATE'
  | 'THREAD_UPDATE'
  | 'THREAD_DELETE'
  | 'MESSAGE_CREATE'
  | 'MESSAGE_UPDATE'
  | 'MESSAGE_DELETE'
  | 'MESSAGE_DELETE_BULK'
  | 'MESSAGE_REACTION_ADD'
  | 'MESSAGE_REACTION_REMOVE'
  | 'MESSAGE_REACTION_REMOVE_ALL'
  | 'MESSAGE_REACTION_REMOVE_EMOJI'
  | 'TYPING_START'
  | 'PRESENCE_UPDATE'
  | 'VOICE_STATE_UPDATE'
  | 'VOICE_SERVER_UPDATE'
  | 'WEBHOOKS_UPDATE'
  | 'INVITE_CREATE'
  | 'INVITE_DELETE'
  | 'USER_UPDATE'
  | 'RELATIONSHIP_ADD'
  | 'RELATIONSHIP_REMOVE'
