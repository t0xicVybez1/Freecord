import { create } from 'zustand'
import type { Guild, GuildMember, Role } from '@freecord/types'

interface GuildsState {
  guilds: Record<string, Guild>
  guildIds: string[]
  getGuild: (id: string) => Guild | undefined
  getGuilds: () => Guild[]
  setGuilds: (guilds: Guild[]) => void
  addGuild: (guild: Guild) => void
  updateGuild: (id: string, data: Partial<Guild>) => void
  removeGuild: (id: string) => void
  addGuildMember: (guildId: string, member: GuildMember) => void
  removeGuildMember: (guildId: string, userId: string) => void
  updateGuildMember: (guildId: string, member: GuildMember) => void
  addRole: (guildId: string, role: Role) => void
  updateRole: (guildId: string, role: Role) => void
  removeRole: (guildId: string, roleId: string) => void
  setEmojis: (guildId: string, emojis: any[]) => void
  reset: () => void
}

export const useGuildsStore = create<GuildsState>((set, get) => ({
  guilds: {},
  guildIds: [],

  getGuild: (id) => get().guilds[id],
  getGuilds: () => get().guildIds.map(id => get().guilds[id]).filter(Boolean),

  setGuilds: (guilds) => set({
    guilds: Object.fromEntries(guilds.map(g => [g.id, g])),
    guildIds: guilds.map(g => g.id),
  }),

  addGuild: (guild) => set(s => ({
    guilds: { ...s.guilds, [guild.id]: guild },
    guildIds: s.guildIds.includes(guild.id) ? s.guildIds : [...s.guildIds, guild.id],
  })),

  updateGuild: (id, data) => set(s => ({
    guilds: s.guilds[id] ? { ...s.guilds, [id]: { ...s.guilds[id], ...data } } : s.guilds,
  })),

  removeGuild: (id) => set(s => {
    const guilds = { ...s.guilds }
    delete guilds[id]
    return { guilds, guildIds: s.guildIds.filter(gid => gid !== id) }
  }),

  addGuildMember: (guildId, member) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    const members = guild.members || []
    if (members.some(m => m.user.id === member.user.id)) return s
    return { guilds: { ...s.guilds, [guildId]: { ...guild, members: [...members, member] } } }
  }),

  removeGuildMember: (guildId, userId) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    return {
      guilds: {
        ...s.guilds,
        [guildId]: { ...guild, members: (guild.members || []).filter(m => m.user.id !== userId) },
      },
    }
  }),

  updateGuildMember: (guildId, member) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    const members = (guild.members || []).map(m =>
      m.user.id === member.user.id ? { ...m, ...member } : m
    )
    return { guilds: { ...s.guilds, [guildId]: { ...guild, members } } }
  }),

  addRole: (guildId, role) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    return { guilds: { ...s.guilds, [guildId]: { ...guild, roles: [...(guild.roles || []), role] } } }
  }),

  updateRole: (guildId, role) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    return { guilds: { ...s.guilds, [guildId]: { ...guild, roles: (guild.roles || []).map(r => r.id === role.id ? role : r) } } }
  }),

  removeRole: (guildId, roleId) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    return { guilds: { ...s.guilds, [guildId]: { ...guild, roles: (guild.roles || []).filter(r => r.id !== roleId) } } }
  }),

  setEmojis: (guildId, emojis) => set(s => {
    const guild = s.guilds[guildId]
    if (!guild) return s
    return { guilds: { ...s.guilds, [guildId]: { ...guild, emojis } } }
  }),

  reset: () => set({ guilds: {}, guildIds: [] }),
}))
