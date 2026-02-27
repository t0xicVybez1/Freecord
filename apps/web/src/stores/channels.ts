import { create } from 'zustand'
import type { Channel } from '@freecord/types'
import { ChannelType } from '@freecord/types'

interface ChannelsState {
  channels: Record<string, Channel>
  guildChannels: Record<string, string[]>   // guildId -> channelIds
  dmChannels: string[]                       // DM channel IDs
  getChannel: (id: string) => Channel | undefined
  getGuildChannels: (guildId: string) => Channel[]
  getDMChannels: () => Channel[]
  setGuildChannels: (guildId: string, channels: Channel[]) => void
  setDMChannels: (channels: Channel[]) => void
  addChannel: (channel: Channel) => void
  addDMChannel: (channel: Channel) => void
  updateChannel: (id: string, data: Partial<Channel>) => void
  removeChannel: (id: string) => void
  reset: () => void
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: {},
  guildChannels: {},
  dmChannels: [],

  getChannel: (id) => get().channels[id],

  getGuildChannels: (guildId) => {
    const ids = get().guildChannels[guildId] || []
    return ids
      .map(id => get().channels[id])
      .filter(Boolean)
      .sort((a, b) => {
        // Categories first, then by position
        if (a.type === ChannelType.GUILD_CATEGORY && b.type !== ChannelType.GUILD_CATEGORY) return -1
        if (b.type === ChannelType.GUILD_CATEGORY && a.type !== ChannelType.GUILD_CATEGORY) return 1
        return (a.position || 0) - (b.position || 0)
      })
  },

  getDMChannels: () => {
    return get().dmChannels.map(id => get().channels[id]).filter(Boolean)
  },

  setGuildChannels: (guildId, channels) => set(s => ({
    channels: { ...s.channels, ...Object.fromEntries(channels.map(c => [c.id, c])) },
    guildChannels: { ...s.guildChannels, [guildId]: channels.map(c => c.id) },
  })),

  setDMChannels: (channels) => set(s => ({
    channels: { ...s.channels, ...Object.fromEntries(channels.map(c => [c.id, c])) },
    dmChannels: channels.map(c => c.id),
  })),

  addChannel: (channel) => set(s => {
    const guildId = channel.guildId
    const guildChs = guildId ? [...(s.guildChannels[guildId] || []), channel.id].filter((v, i, a) => a.indexOf(v) === i) : (s.guildChannels[guildId!] || [])
    return {
      channels: { ...s.channels, [channel.id]: channel },
      guildChannels: guildId ? { ...s.guildChannels, [guildId]: guildChs } : s.guildChannels,
    }
  }),

  addDMChannel: (channel) => set(s => ({
    channels: { ...s.channels, [channel.id]: channel },
    dmChannels: s.dmChannels.includes(channel.id) ? s.dmChannels : [channel.id, ...s.dmChannels],
  })),

  updateChannel: (id, data) => set(s => ({
    channels: s.channels[id] ? { ...s.channels, [id]: { ...s.channels[id], ...data } } : s.channels,
  })),

  removeChannel: (id) => set(s => {
    const channels = { ...s.channels }
    const guildId = channels[id]?.guildId
    delete channels[id]
    const guildChannels = guildId
      ? { ...s.guildChannels, [guildId]: (s.guildChannels[guildId] || []).filter(cid => cid !== id) }
      : s.guildChannels
    return { channels, guildChannels, dmChannels: s.dmChannels.filter(cid => cid !== id) }
  }),

  reset: () => set({ channels: {}, guildChannels: {}, dmChannels: [] }),
}))
