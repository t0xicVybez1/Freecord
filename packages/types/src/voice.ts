export interface VoiceServerUpdate {
  token: string
  guildId: string
  endpoint: string
}

export interface VoiceRoom {
  guildId: string | null
  channelId: string
  members: VoiceRoomMember[]
}

export interface VoiceRoomMember {
  userId: string
  sessionId: string
  deaf: boolean
  mute: boolean
  selfDeaf: boolean
  selfMute: boolean
  selfVideo: boolean
  selfStream: boolean
  speaking: boolean
}

export interface RtpCapabilities {
  codecs: RtpCodecCapability[]
  headerExtensions: RtpHeaderExtension[]
}

export interface RtpCodecCapability {
  kind: 'audio' | 'video'
  mimeType: string
  preferredPayloadType?: number
  clockRate: number
  channels?: number
  parameters?: Record<string, unknown>
  rtcpFeedback?: { type: string; parameter?: string }[]
}

export interface RtpHeaderExtension {
  kind: 'audio' | 'video'
  uri: string
  preferredId: number
  preferredEncrypt?: boolean
  direction?: 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive'
}
