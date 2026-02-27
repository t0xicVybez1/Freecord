import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { useVoiceStore } from '@/stores/voice'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { UserPanel } from './UserPanel'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import {
  Hash, Volume2, ChevronDown, ChevronRight, Plus, Settings,
  UserPlus, Mic, MicOff, LogOut, Lock, Megaphone
} from 'lucide-react'
import type { Channel } from '@freecord/types'
import { ChannelType } from '@freecord/types'

function ChannelItem({ channel, guildId }: { channel: Channel; guildId: string }) {
  const navigate = useNavigate()
  const params = useParams()
  const isActive = params.channelId === channel.id
  const openModal = useUIStore(s => s.openModal)
  const { channelId: voiceChannelId, joinChannel, leaveChannel } = useVoiceStore()
  const user = useAuthStore(s => s.user)
  const voiceStates = useVoiceStore(s => s.voiceStates)
  const voiceMembers = Object.values(voiceStates).filter(vs => vs.channelId === channel.id)
  const guild = useGuildsStore(s => s.guilds[guildId])

  const isVoice = channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE
  const Icon = isVoice ? Volume2 : channel.type === ChannelType.GUILD_ANNOUNCEMENT ? Megaphone : channel.nsfw ? Lock : Hash
  const inVoice = voiceChannelId === channel.id

  const handleClick = () => {
    if (isVoice) {
      if (inVoice) leaveChannel()
      else if (user) joinChannel(guildId, channel.id, user.id)
    } else {
      navigate(`/channels/${guildId}/${channel.id}`)
    }
  }

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1 rounded mx-2 cursor-pointer transition-colors',
          isActive || inVoice ? 'bg-white/[0.12] text-white' : 'text-interactive-normal hover:text-interactive-hover hover:bg-white/[0.06]'
        )}
      >
        <Icon size={18} className="flex-shrink-0 text-interactive-muted" />
        <span className="text-sm font-medium truncate flex-1">{channel.name}</span>
        <div className="hidden group-hover:flex items-center gap-0.5">
          {!isVoice && (
            <Tooltip content="Create Invite">
              <button className="p-0.5 hover:text-white" onClick={e => { e.stopPropagation(); openModal({ type: 'INVITE', data: { guildId, channelId: channel.id } }) }}>
                <UserPlus size={14} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Edit Channel">
            <button className="p-0.5 hover:text-white" onClick={e => { e.stopPropagation(); openModal({ type: 'GUILD_SETTINGS', data: { guildId, tab: 'channels', channelId: channel.id } }) }}>
              <Settings size={14} />
            </button>
          </Tooltip>
        </div>
      </div>
      {/* Voice members */}
      {isVoice && voiceMembers.length > 0 && (
        <div className="ml-8 mt-0.5 space-y-0.5">
          {voiceMembers.map(vs => {
            const member = guild?.members?.find(m => m.user.id === vs.userId)
            if (!member) return null
            return (
              <div key={vs.userId} className="flex items-center gap-1.5 px-2 py-0.5">
                <Avatar userId={member.user.id} username={member.user.username} avatarHash={member.user.avatar} size={20} />
                <span className="text-xs text-interactive-muted truncate">{member.nickname || member.user.username}</span>
                {vs.selfMute && <MicOff size={12} className="text-text-muted" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CategoryItem({ channel, guildId, children }: { channel: Channel; guildId: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const openModal = useUIStore(s => s.openModal)

  return (
    <div>
      <div
        className="group flex items-center gap-1 px-2 py-1 cursor-pointer text-interactive-muted hover:text-interactive-hover"
        onClick={() => setCollapsed(c => !c)}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span className="text-xs font-semibold uppercase tracking-wide flex-1">{channel.name}</span>
        <button
          className="hidden group-hover:block p-0.5 hover:text-white"
          onClick={e => { e.stopPropagation(); openModal({ type: 'CREATE_CHANNEL', data: { guildId, categoryId: channel.id } }) }}
        >
          <Plus size={14} />
        </button>
      </div>
      {!collapsed && children}
    </div>
  )
}

export function ChannelSidebar({ guildId }: { guildId: string }) {
  const guild = useGuildsStore(s => s.guilds[guildId])
  const channels = useChannelsStore(useShallow(s => s.getGuildChannels(guildId)))
  const openModal = useUIStore(s => s.openModal)

  if (!guild) return null

  const categories = channels.filter(c => c.type === ChannelType.GUILD_CATEGORY)
  const uncategorized = channels.filter(c => c.type !== ChannelType.GUILD_CATEGORY && !c.parentId)
  const getChildren = (categoryId: string) => channels.filter(c => c.parentId === categoryId)

  return (
    <div className="w-60 bg-bg-secondary flex flex-col flex-shrink-0">
      {/* Guild header */}
      <button
        className="flex items-center justify-between px-4 py-3 border-b border-black/20 hover:bg-white/[0.06] transition-colors font-semibold text-white text-sm"
        onClick={() => openModal({ type: 'GUILD_SETTINGS', data: { guildId } })}
      >
        <span className="truncate">{guild.name}</span>
        <ChevronDown size={18} className="text-text-muted flex-shrink-0" />
      </button>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {/* Uncategorized channels */}
        {uncategorized.map(ch => <ChannelItem key={ch.id} channel={ch} guildId={guildId} />)}

        {/* Categories with their channels */}
        {categories.map(cat => (
          <CategoryItem key={cat.id} channel={cat} guildId={guildId}>
            {getChildren(cat.id).map(ch => <ChannelItem key={ch.id} channel={ch} guildId={guildId} />)}
          </CategoryItem>
        ))}
      </div>

      <UserPanel />
    </div>
  )
}
