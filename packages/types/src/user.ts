export enum UserStatus {
  ONLINE = 'online',
  IDLE = 'idle',
  DND = 'dnd',
  INVISIBLE = 'invisible',
  OFFLINE = 'offline',
}

export enum RelationshipType {
  FRIEND = 'FRIEND',
  BLOCKED = 'BLOCKED',
  PENDING_INCOMING = 'PENDING_INCOMING',
  PENDING_OUTGOING = 'PENDING_OUTGOING',
}

export interface User {
  id: string
  username: string
  discriminator: string
  displayName: string | null
  avatar: string | null
  banner: string | null
  bio: string
  accentColor: number | null
  status: UserStatus
  customStatus: string | null
  flags: number
  bot: boolean
  system: boolean
  verified: boolean
  mfaEnabled: boolean
  locale: string
  createdAt: string
}

export interface PrivateUser extends User {
  email: string
  phone: string | null
  twoFactorEnabled: boolean
  isStaff: boolean
}

export interface UserSettings {
  theme: 'dark' | 'light'
  locale: string
  messageDisplayCompact: boolean
  developerMode: boolean
  enableTTS: boolean
  explicitContentFilter: 0 | 1 | 2
  defaultNotifications: 0 | 1
  guildPositions: string[]
  friendSourceFlags: number
  restrictedGuilds: string[]
}

export interface Relationship {
  id: string
  type: RelationshipType
  user: User
  createdAt: string
}

export interface PresenceUpdate {
  userId: string
  guildId?: string
  status: UserStatus
  activities: Activity[]
  clientStatus: ClientStatus
}

export interface Activity {
  name: string
  type: 0 | 1 | 2 | 3 | 4 | 5 // Playing, Streaming, Listening, Watching, Custom, Competing
  url?: string
  details?: string
  state?: string
  timestamps?: { start?: number; end?: number }
  assets?: {
    largeImage?: string
    largeText?: string
    smallImage?: string
    smallText?: string
  }
  createdAt: number
}

export interface ClientStatus {
  desktop?: UserStatus
  mobile?: UserStatus
  web?: UserStatus
}
