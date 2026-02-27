import { create } from 'zustand'
import type { VoiceState } from '@freecord/types'
import { voiceClient } from '@/lib/voice'
import { gateway } from '@/lib/gateway'
import api from '@/lib/api'

interface VoiceStoreState {
  channelId: string | null
  guildId: string | null
  selfMute: boolean
  selfDeaf: boolean
  selfVideo: boolean
  selfStream: boolean
  voiceStates: Record<string, VoiceState>
  joinChannel: (guildId: string, channelId: string, userId: string) => Promise<void>
  leaveChannel: () => Promise<void>
  setSelfMute: (muted: boolean) => void
  setSelfDeaf: (deafened: boolean) => void
  setSelfVideo: (video: boolean) => Promise<void>
  setSelfStream: (stream: boolean) => Promise<void>
  setVoiceState: (userId: string, state: Partial<VoiceState>) => void
  clearVoiceState: (userId: string) => void
}

export const useVoiceStore = create<VoiceStoreState>((set, get) => ({
  channelId: null,
  guildId: null,
  selfMute: false,
  selfDeaf: false,
  selfVideo: false,
  selfStream: false,
  voiceStates: {},

  joinChannel: async (guildId, channelId, userId) => {
    const current = get().channelId
    if (current === channelId) return
    if (current) await get().leaveChannel()

    set({ channelId, guildId })
    gateway.updateVoiceState(guildId, channelId, get().selfMute, get().selfDeaf)

    try {
      await voiceClient.join(channelId, userId)
      await voiceClient.startAudio()
    } catch (err) {
      console.error('[Voice] Failed to join', err)
      set({ channelId: null, guildId: null })
    }
  },

  leaveChannel: async () => {
    const { guildId } = get()
    gateway.updateVoiceState(guildId, null, false, false)
    await voiceClient.leave().catch(console.error)
    set({ channelId: null, guildId: null, selfVideo: false, selfStream: false })
  },

  setSelfMute: (muted) => {
    const { guildId, channelId } = get()
    set({ selfMute: muted })
    if (channelId) gateway.updateVoiceState(guildId, channelId, muted, get().selfDeaf)
    voiceClient.muteAudio(muted)
  },

  setSelfDeaf: (deafened) => {
    const { guildId, channelId } = get()
    set({ selfDeaf: deafened, selfMute: deafened ? true : get().selfMute })
    if (channelId) gateway.updateVoiceState(guildId, channelId, deafened || get().selfMute, deafened)
  },

  setSelfVideo: async (video) => {
    if (video) {
      const stream = await voiceClient.startVideo().catch(() => null)
      if (!stream) return // permission denied or not in channel
    } else {
      voiceClient.stopVideo()
    }
    set({ selfVideo: video })
  },

  setSelfStream: async (stream) => {
    if (stream) {
      const mediaStream = await voiceClient.startScreenShare().catch(() => null)
      if (!mediaStream) return // user cancelled picker or not in channel
    } else {
      voiceClient.stopVideo()
    }
    set({ selfStream: stream })
  },

  setVoiceState: (userId, state) => set(s => ({
    voiceStates: { ...s.voiceStates, [userId]: { ...s.voiceStates[userId], ...state } as VoiceState },
  })),

  clearVoiceState: (userId) => set(s => {
    const voiceStates = { ...s.voiceStates }
    delete voiceStates[userId]
    return { voiceStates }
  }),
}))
