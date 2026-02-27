import { useGuildsStore } from '@/stores/guilds'
import { useUsersStore } from '@/stores/users'
import { useUIStore } from '@/stores/ui'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import type { GuildMember } from '@freecord/types'

function MemberItem({ member, guildId }: { member: GuildMember; guildId: string }) {
  const presence = useUsersStore(s => s.presences[member.user.id])
  const guild = useGuildsStore(s => s.guilds[guildId])
  const openModal = useUIStore(s => s.openModal)
  const status = presence?.status || 'offline'

  const roleColor = (() => {
    const roles = guild?.roles || []
    const memberRoles = member.roles.map(rid => roles.find(r => r.id === rid)).filter(Boolean)
    const highest = memberRoles.sort((a, b) => (b?.position || 0) - (a?.position || 0))[0]
    return highest?.color ? `#${highest.color.toString(16).padStart(6, '0')}` : undefined
  })()

  return (
    <div
      className="flex items-center gap-3 px-2 py-1.5 rounded mx-2 cursor-pointer hover:bg-white/[0.06] group"
      onClick={() => openModal({ type: 'USER_PROFILE', data: { userId: member.user.id, guildId } })}
    >
      <Avatar
        userId={member.user.id} username={member.nickname || member.user.username}
        avatarHash={member.user.avatar} size={32} status={status} showStatus
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate group-hover:text-white transition-colors"
          style={{ color: roleColor || '' }}>
          {member.nickname || member.user.username}
        </p>
        {status === 'online' && member.user.customStatus && (
          <p className="text-xs text-text-muted truncate">{member.user.customStatus}</p>
        )}
      </div>
    </div>
  )
}

export function MemberList({ guildId }: { guildId: string }) {
  const guild = useGuildsStore(s => s.guilds[guildId])
  const presences = useUsersStore(s => s.presences)
  if (!guild?.members) return null

  const members = guild.members
  const online = members.filter(m => {
    const s = presences[m.user.id]?.status
    return s && s !== 'offline' && s !== 'invisible'
  })
  const offline = members.filter(m => {
    const s = presences[m.user.id]?.status
    return !s || s === 'offline' || s === 'invisible'
  })

  const SectionHeader = ({ label, count }: { label: string; count: number }) => (
    <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
      {label} — {count}
    </div>
  )

  return (
    <div className="w-60 bg-bg-secondary flex-shrink-0 overflow-y-auto py-2">
      {online.length > 0 && (
        <>
          <SectionHeader label="Online" count={online.length} />
          {online.map(m => <MemberItem key={m.user.id} member={m} guildId={guildId} />)}
        </>
      )}
      {offline.length > 0 && (
        <>
          <SectionHeader label="Offline" count={offline.length} />
          {offline.map(m => <MemberItem key={m.user.id} member={m} guildId={guildId} />)}
        </>
      )}
    </div>
  )
}
