import { create } from 'zustand'
import type { Guild } from '@freecord/types'

interface GuildsState {
  guilds: Record<string, Guild>
  guildIds: string[]
  getGuild: (id: string) => Guild | undefined
  getGuilds: () => Guild[]
  setGuilds: (guilds: Guild[]) => void
  addGuild: (guild: Guild) => void
  updateGuild: (id: string, data: Partial<Guild>) => void
  removeGuild: (id: string) => void
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

  reset: () => set({ guilds: {}, guildIds: [] }),
}))
