import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useChannelsStore } from '@/stores/channels'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { Avatar } from '@/components/ui/Avatar'
import { cn, truncate } from '@/lib/utils'
import { UserPlus, Users } from 'lucide-react'
import { ChannelType } from '@freecord/types'

export function DMChannelList() {
  const navigate = useNavigate()
  const params = useParams()
  const dmChannels = useChannelsStore(useShallow(s => s.getDMChannels()))
  const myId = useAuthStore(s => s.user?.id)
  const presences = useUsersStore(s => s.presences)
  const openModal = useUIStore(s => s.openModal)

  return (
    <div className="w-60 bg-bg-secondary flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/20">
        <div className="bg-bg-input rounded px-2 py-1.5 text-sm text-interactive-muted cursor-text">
          Find or start a conversation
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {/* Friends shortcut */}
        <button
          onClick={() => navigate('/channels/@me')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded mx-1 text-sm font-medium transition-colors',
            !params.dmChannelId ? 'bg-white/[0.12] text-white' : 'text-interactive-normal hover:text-interactive-hover hover:bg-white/[0.06]'
          )}
          style={{ width: 'calc(100% - 8px)' }}
        >
          <Users size={20} className="flex-shrink-0" />
          Friends
        </button>

        {/* DM channels */}
        {dmChannels.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between px-4 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Direct Messages</span>
              <button className="text-text-muted hover:text-white transition-colors">
                <UserPlus size={14} />
              </button>
            </div>
            {dmChannels.map(ch => {
              const isGroup = ch.type === ChannelType.GROUP_DM
              const otherUser = ch.recipients?.find(r => r.id !== myId)
              const status = otherUser ? presences[otherUser.id]?.status : undefined
              const isActive = params.dmChannelId === ch.id
              const name = isGroup
                ? (ch.name || ch.recipients?.map(r => r.username).join(', ') || 'Group DM')
                : (otherUser?.username || 'Unknown')

              return (
                <div
                  key={ch.id}
                  onClick={() => navigate(`/channels/@me/${ch.id}`)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded mx-1 cursor-pointer transition-colors group',
                    isActive ? 'bg-white/[0.12] text-white' : 'text-interactive-normal hover:text-interactive-hover hover:bg-white/[0.06]'
                  )}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  {isGroup ? (
                    <div className="w-8 h-8 rounded-full bg-bg-primary flex items-center justify-center flex-shrink-0">
                      <Users size={16} />
                    </div>
                  ) : otherUser ? (
                    <Avatar userId={otherUser.id} username={otherUser.username} avatarHash={otherUser.avatar}
                      size={32} status={status} showStatus />
                  ) : null}
                  <span className="text-sm font-medium truncate flex-1">{name}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
