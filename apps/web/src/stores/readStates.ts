import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ReadStatesState {
  // channelId → lastReadMessageId (snowflake string)
  lastRead: Record<string, string>
  // channelId → mention count
  mentions: Record<string, number>
  markRead: (channelId: string, messageId: string) => void
  addMention: (channelId: string) => void
  clearMentions: (channelId: string) => void
  isUnread: (channelId: string, latestMessageId: string | undefined) => boolean
  getMentionCount: (channelId: string) => number
  reset: () => void
}

export const useReadStatesStore = create<ReadStatesState>()(
  persist(
    (set, get) => ({
      lastRead: {},
      mentions: {},

      markRead: (channelId, messageId) => set(s => ({
        lastRead: { ...s.lastRead, [channelId]: messageId },
        mentions: { ...s.mentions, [channelId]: 0 },
      })),

      addMention: (channelId) => set(s => ({
        mentions: { ...s.mentions, [channelId]: (s.mentions[channelId] || 0) + 1 },
      })),

      clearMentions: (channelId) => set(s => ({
        mentions: { ...s.mentions, [channelId]: 0 },
      })),

      isUnread: (channelId, latestMessageId) => {
        if (!latestMessageId) return false
        const last = get().lastRead[channelId]
        if (!last) return true
        // Snowflake IDs are lexicographically ordered by time
        return latestMessageId > last
      },

      getMentionCount: (channelId) => get().mentions[channelId] || 0,

      reset: () => set({ lastRead: {}, mentions: {} }),
    }),
    { name: 'freecord-read-states' }
  )
)
