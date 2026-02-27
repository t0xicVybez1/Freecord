import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useChannelsStore } from '@/stores/channels'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useReadStatesStore } from '@/stores/readStates'
import { useMessagesStore } from '@/stores/messages'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { UserPlus, Users, X, Search, Check } from 'lucide-react'
import { ChannelType } from '@freecord/types'
import { api } from '@/lib/api'

function CreateGroupDMModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const relationships = useUsersStore(s => s.relationships)
  const users = useUsersStore(s => s.users)
  const navigate = useNavigate()
  const addDMChannel = useChannelsStore(s => s.addDMChannel)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const friends = Object.values(relationships).filter((r: any) => r.type === 1)
  const filtered = friends.filter((r: any) => {
    const friend = users[r.userId]
    if (!friend) return false
    return friend.username.toLowerCase().includes(query.toLowerCase())
  })

  const toggle = (userId: string) => {
    setSelected(s => s.includes(userId)
      ? s.filter(id => id !== userId)
      : s.length < 9 ? [...s, userId] : s
    )
  }

  const handleCreate = async () => {
    if (selected.length === 0) return
    setCreating(true)
    try {
      const ch = await api.post<any>('/api/v1/channels/group', { recipients: selected })
      addDMChannel(ch)
      navigate(`/channels/@me/${ch.id}`)
      onClose()
    } catch {}
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div ref={ref} className="bg-bg-primary rounded-xl shadow-2xl w-96 flex flex-col overflow-hidden animate-scale-in">
        <div className="px-5 py-4 border-b border-black/20">
          <h2 className="text-lg font-bold text-text-header">Select Friends</h2>
          <p className="text-sm text-text-muted mt-0.5">You can add {9 - selected.length} more friends</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 bg-bg-input rounded px-2 py-1.5">
            <Search size={14} className="text-text-muted" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search friends..."
              className="flex-1 bg-transparent text-sm outline-none text-text-header placeholder-text-muted"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2 max-h-72">
          {filtered.length === 0 && (
            <p className="text-center text-text-muted text-sm py-8">No friends found</p>
          )}
          {filtered.map((r: any) => {
            const friend = users[r.userId]
            if (!friend) return null
            const isSel = selected.includes(r.userId)
            return (
              <div
                key={r.userId}
                onClick={() => toggle(r.userId)}
                className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${isSel ? 'bg-brand/10' : 'hover:bg-white/5'}`}
              >
                <Avatar userId={friend.id} username={friend.username} avatarHash={friend.avatar} size={32} />
                <span className="flex-1 text-sm text-text-header font-medium">{friend.displayName || friend.username}</span>
                <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSel ? 'bg-brand border-brand' : 'border-interactive-muted'}`}>
                  {isSel && <Check size={12} className="text-white" />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-3 border-t border-black/20 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded bg-bg-secondary text-text-muted hover:text-text-header text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={selected.length === 0 || creating}
            className="flex-1 py-2 rounded bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Group DM'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DMChannelList() {
  const navigate = useNavigate()
  const params = useParams()
  const dmChannels = useChannelsStore(useShallow(s => s.getDMChannels()))
  const myId = useAuthStore(s => s.user?.id)
  const presences = useUsersStore(s => s.presences)
  const removeDMChannel = useChannelsStore(s => s.removeDMChannel)
  const [showGroupDM, setShowGroupDM] = useState(false)
  const messages = useMessagesStore(s => s.channels)
  const isUnreadFn = useReadStatesStore(s => s.isUnread)
  const markRead = useReadStatesStore(s => s.markRead)

  const handleCloseDM = async (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation()
    try { await api.delete(`/api/v1/channels/${channelId}`) } catch {}
    removeDMChannel(channelId)
    if (params.dmChannelId === channelId) navigate('/channels/@me')
  }

  return (
    <div className="w-60 bg-bg-secondary flex flex-col flex-shrink-0">
      {showGroupDM && <CreateGroupDMModal onClose={() => setShowGroupDM(false)} />}

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
        <div className="mt-3">
          <div className="flex items-center justify-between px-4 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">Direct Messages</span>
            <button
              onClick={() => setShowGroupDM(true)}
              className="text-text-muted hover:text-white transition-colors"
              title="New Group DM"
            >
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
              : (otherUser?.displayName || otherUser?.username || 'Unknown')

            const chMessages = messages[ch.id]
            const latestId = chMessages?.orderedIds[chMessages.orderedIds.length - 1]
            const hasUnread = isUnreadFn(ch.id, latestId)

            return (
              <div
                key={ch.id}
                onClick={() => {
                  navigate(`/channels/@me/${ch.id}`)
                  if (latestId) markRead(ch.id, latestId)
                }}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded mx-1 cursor-pointer transition-colors group',
                  isActive
                    ? 'bg-white/[0.12] text-white'
                    : hasUnread
                      ? 'text-white font-semibold hover:bg-white/[0.06]'
                      : 'text-interactive-normal hover:text-interactive-hover hover:bg-white/[0.06]'
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
                {hasUnread && !isActive && <div className="w-2 h-2 bg-white rounded-full flex-shrink-0" />}
                <button
                  onClick={e => handleCloseDM(e, ch.id)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-header transition-all flex-shrink-0 ml-1"
                  title="Close DM"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
