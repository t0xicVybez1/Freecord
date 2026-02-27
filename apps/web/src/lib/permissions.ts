import { PermissionFlagsBits, PermissionsBitField, computeBasePermissions, computeOverwrites } from '@freecord/permissions'
import type { Guild, GuildMember, Channel } from '@freecord/types'

export { PermissionFlagsBits, PermissionsBitField }

export function getMemberPermissions(guild: Guild, member: GuildMember, channel?: Channel): PermissionsBitField {
  const roles = guild.roles || []
  const everyone = roles.find(r => r.name === '@everyone')
  const everyoneId = everyone?.id || guild.id

  const base = computeBasePermissions(
    member.roles,
    roles.map(r => ({ id: r.id, permissions: r.permissions, position: r.position })),
    everyoneId, guild.ownerId, member.user.id
  )

  if (!channel) return new PermissionsBitField(base)
  const effective = computeOverwrites(base, member.roles, member.user.id,
    channel.permissionOverwrites.map(o => ({ id: o.id, type: o.type, allow: o.allow, deny: o.deny })),
    everyoneId
  )
  return new PermissionsBitField(effective)
}

export function can(guild: Guild, member: GuildMember, flag: keyof typeof PermissionFlagsBits, channel?: Channel): boolean {
  return getMemberPermissions(guild, member, channel).has(flag)
}
