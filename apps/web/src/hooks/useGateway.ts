import { useEffect } from 'react'
import { gateway } from '@/lib/gateway'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { useMessagesStore } from '@/stores/messages'
import { useUsersStore } from '@/stores/users'
import { useVoiceStore } from '@/stores/voice'
import { useAuthStore } from '@/stores/auth'
import { useReadStatesStore } from '@/stores/readStates'
import type { Guild, Channel, Message, GuildMember, VoiceState, User, Relationship, Role } from '@freecord/types'

// Request notification permission on first load
if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
  Notification.requestPermission()
}

let notifSound: AudioBuffer | null = null

async function loadNotifSound() {
  if (notifSound || typeof AudioContext === 'undefined') return
  try {
    const ctx = new AudioContext()
    // Simple beep: 880Hz for 0.08s, then 1100Hz for 0.06s
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < buf.length; i++) {
      const t = i / ctx.sampleRate
      const freq = t < 0.08 ? 880 : 1100
      data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 12) * 0.3
    }
    notifSound = buf
  } catch {}
}

function playNotifSound() {
  try {
    if (typeof AudioContext === 'undefined') return
    const ctx = new AudioContext()
    if (!notifSound) return
    const src = ctx.createBufferSource()
    src.buffer = notifSound
    src.connect(ctx.destination)
    src.start()
  } catch {}
}

export function useGateway() {
  const { setGuilds, addGuild, updateGuild, removeGuild, addGuildMember, removeGuildMember, updateGuildMember, addRole, updateRole, removeRole, setEmojis } = useGuildsStore()
  const { setGuildChannels, addChannel, updateChannel, removeChannel, addDMChannel, setDMChannels } = useChannelsStore()
  const { addMessage, updateMessage, removeMessage, removeMessages, addReaction, removeReaction, clearReactions } = useMessagesStore()
  const { setUser, setUsers, setPresence, setRelationships, addRelationship, removeRelationship } = useUsersStore()
  const { setVoiceState, clearVoiceState } = useVoiceStore()
  const { updateUser, user: currentUser } = useAuthStore()
  const { markRead, addMention, isUnread } = useReadStatesStore()

  useEffect(() => {
    loadNotifSound()
  }, [])

  useEffect(() => {
    const off: (() => void)[] = []

    off.push(gateway.on('READY', (data: any) => {
      setGuilds(data.guilds || [])
      for (const guild of data.guilds || []) {
        setGuildChannels(guild.id, guild.channels || [])
        setUsers((guild.members || []).map((m: GuildMember) => m.user).filter(Boolean))
      }
      setDMChannels(data.privateChannels || [])
      setRelationships(data.relationships || [])
      for (const p of data.presences || []) setPresence(p.userId, p)
    }))

    // Guild lifecycle
    off.push(gateway.on('GUILD_CREATE', (d: Guild) => {
      addGuild(d)
      setGuildChannels(d.id, d.channels || [])
      setUsers((d.members || []).map((m: GuildMember) => m.user).filter(Boolean))
    }))
    off.push(gateway.on('GUILD_UPDATE', (d: Guild) => updateGuild(d.id, d)))
    off.push(gateway.on('GUILD_DELETE', (d: { id: string }) => removeGuild(d.id)))

    // Guild members
    off.push(gateway.on('GUILD_MEMBER_ADD', (d: GuildMember & { guildId: string }) => {
      if (d.user) setUser(d.user)
      addGuildMember(d.guildId, d)
    }))
    off.push(gateway.on('GUILD_MEMBER_REMOVE', (d: { guildId: string; user: User }) => {
      removeGuildMember(d.guildId, d.user.id)
    }))
    off.push(gateway.on('GUILD_MEMBER_UPDATE', (d: GuildMember & { guildId: string }) => {
      if (d.user) setUser(d.user)
      updateGuildMember(d.guildId, d)
    }))

    // Roles
    off.push(gateway.on('GUILD_ROLE_CREATE', (d: Role & { guildId: string }) => addRole(d.guildId, d)))
    off.push(gateway.on('GUILD_ROLE_UPDATE', (d: Role & { guildId: string }) => updateRole(d.guildId, d)))
    off.push(gateway.on('GUILD_ROLE_DELETE', (d: { guildId: string; roleId: string }) => removeRole(d.guildId, d.roleId)))

    // Emojis
    off.push(gateway.on('GUILD_EMOJIS_UPDATE', (d: { guildId: string; emojis: any[] }) => setEmojis(d.guildId, d.emojis)))

    // Channels
    off.push(gateway.on('CHANNEL_CREATE', (d: Channel) => { if (d.guildId) addChannel(d); else addDMChannel(d) }))
    off.push(gateway.on('CHANNEL_UPDATE', (d: Channel) => updateChannel(d.id, d)))
    off.push(gateway.on('CHANNEL_DELETE', (d: { id: string }) => removeChannel(d.id)))

    // Messages — track unread + desktop notifications
    off.push(gateway.on('MESSAGE_CREATE', (d: Message) => {
      addMessage(d.channelId, d)

      // Skip if authored by self
      if (d.author?.id === currentUser?.id) return

      // Check if channel is currently active (user is looking at it)
      const isActiveChannel = window.location.pathname.includes(`/${d.channelId}`)

      if (!isActiveChannel) {
        // Track as unread
        const mentionsMe = d.mentionEveryone || d.mentions?.some(u => u.id === currentUser?.id)
        if (mentionsMe) addMention(d.channelId)

        // Desktop notification
        if (
          Notification.permission === 'granted' &&
          document.hidden &&
          d.author?.username
        ) {
          const notif = new Notification(d.author.displayName || d.author.username, {
            body: d.content.slice(0, 100) || 'New message',
            icon: d.author.avatar
              ? `https://cdn.discordapp.com/avatars/${d.author.id}/${d.author.avatar}.png?size=64`
              : undefined,
            silent: false,
          })
          notif.onclick = () => {
            window.focus()
            notif.close()
          }
          playNotifSound()
        }
      } else {
        // Channel is active — mark as read automatically
        markRead(d.channelId, d.id)
      }
    }))
    off.push(gateway.on('MESSAGE_UPDATE', (d: Partial<Message> & { id: string; channelId: string }) => updateMessage(d.channelId, d.id, d)))
    off.push(gateway.on('MESSAGE_DELETE', (d: { id: string; channelId: string }) => removeMessage(d.channelId, d.id)))
    off.push(gateway.on('MESSAGE_DELETE_BULK', (d: { ids: string[]; channelId: string }) => removeMessages(d.channelId, d.ids)))

    // Reactions
    off.push(gateway.on('MESSAGE_REACTION_ADD', (d: any) => {
      const isMe = d.userId === currentUser?.id
      addReaction(d.channelId, d.messageId, d.emoji, d.userId, isMe)
    }))
    off.push(gateway.on('MESSAGE_REACTION_REMOVE', (d: any) => {
      const isMe = d.userId === currentUser?.id
      removeReaction(d.channelId, d.messageId, d.emoji, d.userId, isMe)
    }))
    off.push(gateway.on('MESSAGE_REACTION_REMOVE_ALL', (d: { channelId: string; messageId: string }) => {
      clearReactions(d.channelId, d.messageId)
    }))

    // Presence & voice
    off.push(gateway.on('PRESENCE_UPDATE', (d: any) => setPresence(d.userId, d)))
    off.push(gateway.on('VOICE_STATE_UPDATE', (d: VoiceState) => {
      if (d.channelId) setVoiceState(d.userId, d)
      else clearVoiceState(d.userId)
    }))

    // User & relationships
    off.push(gateway.on('USER_UPDATE', (d: User) => { updateUser(d as any); setUser(d); setPresence(d.id, { userId: d.id, status: d.status as any }) }))
    off.push(gateway.on('RELATIONSHIP_ADD', (d: Relationship) => addRelationship(d)))
    off.push(gateway.on('RELATIONSHIP_UPDATE', (d: Relationship) => addRelationship(d)))
    off.push(gateway.on('RELATIONSHIP_REMOVE', (d: { id: string; userId: string }) => removeRelationship(d.userId)))

    return () => off.forEach(fn => fn())
  }, [])
}
