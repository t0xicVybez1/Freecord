import { useEffect } from 'react'
import { gateway } from '@/lib/gateway'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { useMessagesStore } from '@/stores/messages'
import { useUsersStore } from '@/stores/users'
import { useVoiceStore } from '@/stores/voice'
import { useAuthStore } from '@/stores/auth'
import type { Guild, Channel, Message, GuildMember, VoiceState, User, Relationship } from '@freecord/types'

export function useGateway() {
  const { setGuilds, addGuild, updateGuild, removeGuild, addGuildMember, removeGuildMember, updateGuildMember } = useGuildsStore()
  const { setGuildChannels, addChannel, updateChannel, removeChannel, addDMChannel, setDMChannels } = useChannelsStore()
  const { addMessage, updateMessage, removeMessage, removeMessages, addReaction, removeReaction, clearReactions } = useMessagesStore()
  const { setUser, setUsers, setPresence, setRelationships, addRelationship, removeRelationship } = useUsersStore()
  const { setVoiceState, clearVoiceState } = useVoiceStore()
  const { updateUser, user: currentUser } = useAuthStore()

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

    // Guild members — keep guild.members in sync so MemberList updates live
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

    // Channels
    off.push(gateway.on('CHANNEL_CREATE', (d: Channel) => { if (d.guildId) addChannel(d); else addDMChannel(d) }))
    off.push(gateway.on('CHANNEL_UPDATE', (d: Channel) => updateChannel(d.id, d)))
    off.push(gateway.on('CHANNEL_DELETE', (d: { id: string }) => removeChannel(d.id)))

    // Messages
    off.push(gateway.on('MESSAGE_CREATE', (d: Message) => addMessage(d.channelId, d)))
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
