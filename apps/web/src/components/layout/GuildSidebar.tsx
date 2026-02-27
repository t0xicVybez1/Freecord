import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { useUIStore } from '@/stores/ui'
import { useMessagesStore } from '@/stores/messages'
import { useReadStatesStore } from '@/stores/readStates'
import { Tooltip } from '@/components/ui/Tooltip'
import { CDNUtils } from '@/lib/cdn'
import { cn, stringToColor, getInitials } from '@/lib/utils'
import { Plus, Compass, MessageSquare } from 'lucide-react'
import { ChannelType } from '@freecord/types'

function GuildIcon({ guild, isActive }: { guild: { id: string; name: string; icon: string | null }; isActive: boolean }) {
  const navigate = useNavigate()
  const channels = useChannelsStore(useShallow(s => s.getGuildChannels(guild.id)))
  const messages = useMessagesStore(s => s.channels)
  const isUnread = useReadStatesStore(s => s.isUnread)
  const getMentionCount = useReadStatesStore(s => s.getMentionCount)

  // Check if any channel in this guild has unread messages
  const guildChannels = channels.filter(c => c.type === ChannelType.GUILD_TEXT || c.type === ChannelType.GUILD_ANNOUNCEMENT)
  const hasUnread = guildChannels.some(c => {
    const ch = messages[c.id]
    const latestId = ch?.orderedIds[ch.orderedIds.length - 1]
    return isUnread(c.id, latestId)
  })
  const totalMentions = guildChannels.reduce((sum, c) => sum + getMentionCount(c.id), 0)

  const handleClick = () => {
    const first = channels.find(c => c.type === ChannelType.GUILD_TEXT)
    navigate(first ? `/channels/${guild.id}/${first.id}` : `/channels/${guild.id}`)
  }

  return (
    <Tooltip content={guild.name} side="right">
      <div className="relative group flex items-center" onClick={handleClick}>
        {/* Active/hover indicator */}
        <div className={cn(
          'absolute -left-3 w-1 rounded-r-full bg-white transition-all',
          isActive ? 'h-10' : hasUnread ? 'h-2 group-hover:h-5' : 'h-0 group-hover:h-5'
        )} />
        <div className={cn(
          'w-12 h-12 rounded-full overflow-hidden cursor-pointer transition-all flex items-center justify-center text-white font-bold text-lg select-none',
          isActive ? 'rounded-2xl' : 'group-hover:rounded-2xl',
          'hover:brightness-90'
        )}
          style={{ backgroundColor: guild.icon ? undefined : stringToColor(guild.name) }}
        >
          {guild.icon
            ? <img src={CDNUtils.guildIcon(guild.id, guild.icon)} alt={guild.name} className="w-full h-full object-cover" />
            : getInitials(guild.name)
          }
        </div>
        {/* Unread / mention badge */}
        {isActive ? null : totalMentions > 0 ? (
          <div className="unread-mention">{totalMentions > 99 ? '99+' : totalMentions}</div>
        ) : hasUnread ? (
          <div className="unread-dot" />
        ) : null}
      </div>
    </Tooltip>
  )
}

export function GuildSidebar() {
  const navigate = useNavigate()
  const params = useParams()
  const guilds = useGuildsStore(useShallow(s => s.getGuilds()))
  const openModal = useUIStore(s => s.openModal)

  return (
    <div className="w-[72px] bg-bg-tertiary flex flex-col items-center py-3 gap-2 overflow-y-auto flex-shrink-0">
      {/* Home button */}
      <Tooltip content="Direct Messages" side="right">
        <div
          onClick={() => navigate('/channels/@me')}
          className={cn(
            'w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all group',
            !params.guildId ? 'bg-brand rounded-2xl' : 'bg-bg-secondary hover:bg-brand hover:rounded-2xl'
          )}
        >
          <MessageSquare size={24} className="text-white" />
        </div>
      </Tooltip>

      {/* Separator */}
      <div className="w-8 h-px bg-white/[0.1]" />

      {/* Guild list */}
      {guilds.map(guild => (
        <GuildIcon key={guild.id} guild={guild} isActive={params.guildId === guild.id} />
      ))}

      {/* Separator */}
      {guilds.length > 0 && <div className="w-8 h-px bg-white/[0.1]" />}

      {/* Add server */}
      <Tooltip content="Add a Server" side="right">
        <div
          onClick={() => openModal({ type: 'CREATE_GUILD' })}
          className="w-12 h-12 rounded-full bg-bg-secondary hover:bg-success hover:rounded-2xl flex items-center justify-center cursor-pointer text-success hover:text-white transition-all"
        >
          <Plus size={24} />
        </div>
      </Tooltip>

      {/* Discover */}
      <Tooltip content="Explore Servers" side="right">
        <div
          onClick={() => navigate('/explore')}
          className="w-12 h-12 rounded-full bg-bg-secondary hover:bg-success hover:rounded-2xl flex items-center justify-center cursor-pointer text-success hover:text-white transition-all"
        >
          <Compass size={24} />
        </div>
      </Tooltip>
    </div>
  )
}
