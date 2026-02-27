import { useAuthStore } from '@/stores/auth'
import { useGuildsStore } from '@/stores/guilds'
import { getMemberPermissions, PermissionFlagsBits } from '@/lib/permissions'
import type { Channel, Guild, GuildMember } from '@freecord/types'

export function usePermissions(guildId?: string, channel?: Channel) {
  const user = useAuthStore(s => s.user)
  const guild = useGuildsStore(s => guildId ? s.guilds[guildId] : undefined)

  if (!guildId || !user || !guild) return { can: () => false, isOwner: false, isAdmin: false }

  const member = guild.members?.find(m => m.user.id === user.id)
  if (!member) return { can: () => false, isOwner: false, isAdmin: false }

  const perms = getMemberPermissions(guild, member, channel)
  const isOwner = guild.ownerId === user.id

  return {
    can: (flag: keyof typeof PermissionFlagsBits) => perms.has(flag),
    isOwner,
    isAdmin: isOwner || perms.has('ADMINISTRATOR'),
    perms,
  }
}
