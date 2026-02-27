import { create } from 'zustand'
import type { Message } from '@freecord/types'

interface ChannelMessages {
  messages: Record<string, Message>
  orderedIds: string[]
  hasMore: boolean
  isLoading: boolean
}

interface MessagesState {
  channels: Record<string, ChannelMessages>
  getMessages: (channelId: string) => Message[]
  getChannelState: (channelId: string) => ChannelMessages | undefined
  setMessages: (channelId: string, messages: Message[], hasMore?: boolean) => void
  prependMessages: (channelId: string, messages: Message[]) => void
  addMessage: (channelId: string, message: Message) => void
  updateMessage: (channelId: string, messageId: string, data: Partial<Message>) => void
  removeMessage: (channelId: string, messageId: string) => void
  removeMessages: (channelId: string, messageIds: string[]) => void
  addReaction: (channelId: string, messageId: string, emoji: { id: string | null; name: string; animated: boolean }, userId: string, isMe: boolean) => void
  removeReaction: (channelId: string, messageId: string, emoji: { id: string | null; name: string; animated: boolean }, userId: string, isMe: boolean) => void
  clearReactions: (channelId: string, messageId: string) => void
  setLoading: (channelId: string, loading: boolean) => void
  reset: () => void
}

const defaultChannelState = (): ChannelMessages => ({ messages: {}, orderedIds: [], hasMore: true, isLoading: false })

export const useMessagesStore = create<MessagesState>((set, get) => ({
  channels: {},

  getMessages: (channelId) => {
    const ch = get().channels[channelId]
    if (!ch) return []
    return ch.orderedIds.map(id => ch.messages[id]).filter(Boolean)
  },

  getChannelState: (channelId) => get().channels[channelId],

  setMessages: (channelId, messages, hasMore = true) => set(s => ({
    channels: {
      ...s.channels,
      [channelId]: {
        messages: Object.fromEntries(messages.map(m => [m.id, m])),
        orderedIds: [...messages].sort((a, b) => a.id < b.id ? -1 : 1).map(m => m.id),
        hasMore,
        isLoading: false,
      },
    },
  })),

  prependMessages: (channelId, messages) => set(s => {
    const existing = s.channels[channelId] || defaultChannelState()
    const newMsgs = { ...existing.messages, ...Object.fromEntries(messages.map(m => [m.id, m])) }
    const sorted = Object.values(newMsgs).sort((a, b) => a.id < b.id ? -1 : 1).map(m => m.id)
    return { channels: { ...s.channels, [channelId]: { ...existing, messages: newMsgs, orderedIds: sorted, hasMore: messages.length >= 50 } } }
  }),

  addMessage: (channelId, message) => set(s => {
    const existing = s.channels[channelId] || defaultChannelState()
    if (existing.messages[message.id]) return s
    const newMsgs = { ...existing.messages, [message.id]: message }
    const orderedIds = [...existing.orderedIds, message.id]
    return { channels: { ...s.channels, [channelId]: { ...existing, messages: newMsgs, orderedIds } } }
  }),

  updateMessage: (channelId, messageId, data) => set(s => {
    const existing = s.channels[channelId]
    if (!existing?.messages[messageId]) return s
    return {
      channels: {
        ...s.channels,
        [channelId]: { ...existing, messages: { ...existing.messages, [messageId]: { ...existing.messages[messageId], ...data } } },
      },
    }
  }),

  removeMessage: (channelId, messageId) => set(s => {
    const existing = s.channels[channelId]
    if (!existing) return s
    const messages = { ...existing.messages }
    delete messages[messageId]
    return { channels: { ...s.channels, [channelId]: { ...existing, messages, orderedIds: existing.orderedIds.filter(id => id !== messageId) } } }
  }),

  removeMessages: (channelId, messageIds) => set(s => {
    const existing = s.channels[channelId]
    if (!existing) return s
    const messages = { ...existing.messages }
    const idSet = new Set(messageIds)
    idSet.forEach(id => delete messages[id])
    return {
      channels: {
        ...s.channels,
        [channelId]: { ...existing, messages, orderedIds: existing.orderedIds.filter(id => !idSet.has(id)) },
      },
    }
  }),

  addReaction: (channelId, messageId, emoji, _userId, isMe) => set(s => {
    const existing = s.channels[channelId]
    if (!existing?.messages[messageId]) return s
    const msg = existing.messages[messageId]
    const reactions = [...(msg.reactions || [])]
    const idx = reactions.findIndex(r => r.emoji.name === emoji.name && r.emoji.id === emoji.id)
    if (idx >= 0) {
      reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, me: reactions[idx].me || isMe }
    } else {
      reactions.push({ emoji, count: 1, me: isMe })
    }
    return {
      channels: {
        ...s.channels,
        [channelId]: { ...existing, messages: { ...existing.messages, [messageId]: { ...msg, reactions } } },
      },
    }
  }),

  removeReaction: (channelId, messageId, emoji, _userId, isMe) => set(s => {
    const existing = s.channels[channelId]
    if (!existing?.messages[messageId]) return s
    const msg = existing.messages[messageId]
    const reactions = [...(msg.reactions || [])]
    const idx = reactions.findIndex(r => r.emoji.name === emoji.name && r.emoji.id === emoji.id)
    if (idx >= 0) {
      const updated = { ...reactions[idx], count: reactions[idx].count - 1, me: isMe ? false : reactions[idx].me }
      if (updated.count <= 0) reactions.splice(idx, 1)
      else reactions[idx] = updated
    }
    return {
      channels: {
        ...s.channels,
        [channelId]: { ...existing, messages: { ...existing.messages, [messageId]: { ...msg, reactions } } },
      },
    }
  }),

  clearReactions: (channelId, messageId) => set(s => {
    const existing = s.channels[channelId]
    if (!existing?.messages[messageId]) return s
    const msg = existing.messages[messageId]
    return {
      channels: {
        ...s.channels,
        [channelId]: { ...existing, messages: { ...existing.messages, [messageId]: { ...msg, reactions: [] } } },
      },
    }
  }),

  setLoading: (channelId, loading) => set(s => ({
    channels: { ...s.channels, [channelId]: { ...(s.channels[channelId] || defaultChannelState()), isLoading: loading } },
  })),

  reset: () => set({ channels: {} }),
}))
