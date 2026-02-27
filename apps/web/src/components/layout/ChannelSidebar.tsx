import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { useVoiceStore } from '@/stores/voice'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import { useReadStatesStore } from '@/stores/readStates'
import { UserPanel } from './UserPanel'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import {
  Hash, Volume2, ChevronDown, ChevronRight, Plus, Settings,
  UserPlus, Mic, MicOff, LogOut, Lock, Megaphone, MessageSquare, Bell, BellOff, BellRing, MessagesSquare
} from 'lucide-react'
import type { Channel } from '@freecord/types'
import { ChannelType } from '@freecord/types'

type NotifLevel = 'all' | 'mentions' | 'nothing'

const NOTIF_STORAGE_KEY = 'freecord_channel_notifs'

function getStoredNotifs(): Record<string, NotifLevel> {
  try { return JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || '{}') } catch { return {} }
}

function setStoredNotif(channelId: string, level: NotifLevel) {
  const all = getStoredNotifs()
  if (level === 'all') delete all[channelId]
  else all[channelId] = level
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(all))
}

function NotifDropdown({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const current: NotifLevel = getStoredNotifs()[channelId] || 'all'
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 bg-bg-floating border border-black/30 rounded-lg shadow-xl z-50 w-44 py-1 text-sm">
      <p className="px-3 py-1 text-xs text-text-muted font-semibold uppercase tracking-wide">Notifications</p>
      {([
        { value: 'all', label: 'All Messages', icon: <BellRing size={13} /> },
        { value: 'mentions', label: 'Only @Mentions', icon: <Bell size={13} /> },
        { value: 'nothing', label: 'Nothing', icon: <BellOff size={13} /> },
      ] as { value: NotifLevel; label: string; icon: React.ReactNode }[]).map(opt => (
        <button
          key={opt.value}
          onClick={() => { setStoredNotif(channelId, opt.value); onClose(); }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.06] transition-colors ${current === opt.value ? 'text-white' : 'text-text-muted'}`}
        >
          {opt.icon}
          {opt.label}
          {current === opt.value && <span className="ml-auto text-brand text-xs">✓</span>}
        </button>
      ))}
    </div>
  )
}

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
  const [showNotifMenu, setShowNotifMenu] = useState(false)

  // Unread state
  const channelMessages = useMessagesStore(s => s.channels[channel.id])
  const latestId = channelMessages?.orderedIds[channelMessages.orderedIds.length - 1]
  const isUnread = useReadStatesStore(s => s.isUnread(channel.id, latestId))
  const mentionCount = useReadStatesStore(s => s.getMentionCount(channel.id))
  const markRead = useReadStatesStore(s => s.markRead)

  const isVoice = channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE
  const isThread = channel.type === ChannelType.PUBLIC_THREAD || channel.type === ChannelType.PRIVATE_THREAD
  const Icon = isVoice ? Volume2 : isThread ? MessageSquare : channel.type === ChannelType.GUILD_ANNOUNCEMENT ? Megaphone : channel.nsfw ? Lock : Hash
  const inVoice = voiceChannelId === channel.id
  const notifLevel: NotifLevel = getStoredNotifs()[channel.id] || 'all'

  const handleClick = () => {
    if (isVoice) {
      if (inVoice) leaveChannel()
      else if (user) joinChannel(guildId, channel.id, user.id)
    } else {
      navigate(`/channels/${guildId}/${channel.id}`)
      if (latestId) markRead(channel.id, latestId)
    }
  }

  const NotifIcon = notifLevel === 'nothing' ? BellOff : notifLevel === 'mentions' ? Bell : null
  const showUnreadIndicator = !isActive && isUnread && notifLevel !== 'nothing'

  return (
    <div>
      <div
        onClick={handleClick}
        className={cn(
          'group relative flex items-center gap-1.5 px-2 py-1 rounded mx-2 cursor-pointer transition-colors',
          isActive || inVoice
            ? 'bg-white/[0.12] text-white'
            : showUnreadIndicator
              ? 'text-white font-semibold hover:bg-white/[0.06]'
              : 'text-interactive-normal hover:text-interactive-hover hover:bg-white/[0.06]'
        )}
      >
        {/* Unread pill */}
        {showUnreadIndicator && !isActive && (
          <div className="absolute -left-2 w-1 h-2 bg-white rounded-r-full" />
        )}
        <Icon size={18} className="flex-shrink-0 text-interactive-muted" />
        <span className="text-sm truncate flex-1">{channel.name}</span>
        {mentionCount > 0 && !isActive && (
          <span className="bg-danger text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none flex-shrink-0">
            {mentionCount > 9 ? '9+' : mentionCount}
          </span>
        )}
        {NotifIcon && !isActive && !mentionCount && <NotifIcon size={12} className="text-text-muted flex-shrink-0" />}
        <div className="hidden group-hover:flex items-center gap-0.5">
          {!isVoice && (
            <Tooltip content="Create Invite">
              <button className="p-0.5 hover:text-white" onClick={e => { e.stopPropagation(); openModal({ type: 'INVITE', data: { guildId, channelId: channel.id } }) }}>
                <UserPlus size={14} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Notification Settings">
            <button className="p-0.5 hover:text-white relative" onClick={e => { e.stopPropagation(); setShowNotifMenu(v => !v) }}>
              <Bell size={14} />
              {showNotifMenu && <NotifDropdown channelId={channel.id} onClose={() => setShowNotifMenu(false)} />}
            </button>
          </Tooltip>
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

function ThreadBrowserPanel({ threads, guildId, channels }: { threads: Channel[]; guildId: string; channels: Channel[] }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  if (threads.length === 0) return null

  return (
    <div className="border-t border-black/20 flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-interactive-muted hover:text-interactive-hover text-xs font-semibold uppercase tracking-wide"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <MessagesSquare size={12} />
        <span>Active Threads ({threads.length})</span>
      </button>
      {open && (
        <div className="pb-2 max-h-48 overflow-y-auto space-y-0.5">
          {threads.map(thread => {
            const parent = channels.find(c => c.id === thread.parentId)
            return (
              <button
                key={thread.id}
                onClick={() => navigate(`/channels/${guildId}/${thread.id}`)}
                className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors group"
              >
                <MessageSquare size={13} className="text-text-muted flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-interactive-normal text-xs truncate group-hover:text-white">{thread.name}</p>
                  {parent && <p className="text-text-muted text-[10px] truncate">#{parent.name}</p>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ChannelSidebar({ guildId }: { guildId: string }) {
  const guild = useGuildsStore(s => s.guilds[guildId])
  const channels = useChannelsStore(useShallow(s => s.getGuildChannels(guildId)))
  const openModal = useUIStore(s => s.openModal)

  if (!guild) return null

  const isThread = (c: Channel) => c.type === ChannelType.PUBLIC_THREAD || c.type === ChannelType.PRIVATE_THREAD
  const categories = channels.filter(c => c.type === ChannelType.GUILD_CATEGORY)
  const threads = channels.filter(isThread)
  const uncategorized = channels.filter(c => c.type !== ChannelType.GUILD_CATEGORY && !c.parentId && !isThread(c))
  const getChildren = (categoryId: string) => channels.filter(c => c.parentId === categoryId && !isThread(c))
  const getThreads = (channelId: string) => threads.filter(t => t.parentId === channelId)

  return (
    <div className="w-60 bg-bg-secondary flex flex-col flex-shrink-0">
      {/* Guild header */}
      <div className="flex items-center border-b border-black/20 flex-shrink-0">
        <button
          className="flex items-center gap-1 flex-1 px-4 py-3 hover:bg-white/[0.06] transition-colors font-semibold text-white text-sm min-w-0"
          onClick={() => openModal({ type: 'GUILD_SETTINGS', data: { guildId } })}
        >
          <span className="truncate">{guild.name}</span>
          <ChevronDown size={18} className="text-text-muted flex-shrink-0 ml-auto" />
        </button>
        <Tooltip content="Create Channel">
          <button
            className="px-3 py-3 text-text-muted hover:text-white transition-colors flex-shrink-0"
            onClick={() => openModal({ type: 'CREATE_CHANNEL', data: { guildId } })}
          >
            <Plus size={18} />
          </button>
        </Tooltip>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
            <Hash size={32} className="text-text-muted" />
            <p className="text-text-muted text-sm">No channels yet</p>
            <button
              className="text-brand text-sm hover:underline"
              onClick={() => openModal({ type: 'CREATE_CHANNEL', data: { guildId } })}
            >
              Create a Channel
            </button>
          </div>
        ) : (
          <>
            {/* Uncategorized channels + their threads */}
            {uncategorized.map(ch => (
              <div key={ch.id}>
                <ChannelItem channel={ch} guildId={guildId} />
                {getThreads(ch.id).map(t => (
                  <div key={t.id} className="ml-4 border-l border-white/10 pl-1">
                    <ChannelItem channel={t} guildId={guildId} />
                  </div>
                ))}
              </div>
            ))}

            {/* Categories with their channels + threads */}
            {categories.map(cat => (
              <CategoryItem key={cat.id} channel={cat} guildId={guildId}>
                {getChildren(cat.id).map(ch => (
                  <div key={ch.id}>
                    <ChannelItem channel={ch} guildId={guildId} />
                    {getThreads(ch.id).map(t => (
                      <div key={t.id} className="ml-4 border-l border-white/10 pl-1">
                        <ChannelItem channel={t} guildId={guildId} />
                      </div>
                    ))}
                  </div>
                ))}
              </CategoryItem>
            ))}
          </>
        )}
      </div>

      <ThreadBrowserPanel threads={threads} guildId={guildId} channels={channels} />
      <UserPanel />
    </div>
  )
}
