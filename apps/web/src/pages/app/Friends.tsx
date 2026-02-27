import { useState, useEffect } from 'react'
import { useUsersStore } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getStatusColor } from '@/lib/utils'
import api from '@/lib/api'
import { UserPlus, Check, X, UserMinus, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Relationship, Channel } from '@freecord/types'
import { useChannelsStore } from '@/stores/channels'

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add'

export default function FriendsPage() {
  const [tab, setTab] = useState<Tab>('online')
  const [addUsername, setAddUsername] = useState('')
  const [addStatus, setAddStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [addMsg, setAddMsg] = useState('')
  const { relationships, presences, setRelationships } = useUsersStore()
  const myId = useAuthStore(s => s.user?.id)
  const navigate = useNavigate()
  const { addDMChannel } = useChannelsStore()

  useEffect(() => {
    api.get<Relationship[]>('/api/v1/users/@me/relationships').then(rels => {
      useUsersStore.getState().setRelationships(rels)
    }).catch(() => {})
  }, [])

  const friends = relationships.filter(r => r.type === 'FRIEND')
  const incoming = relationships.filter(r => r.type === 'PENDING_INCOMING')
  const outgoing = relationships.filter(r => r.type === 'PENDING_OUTGOING')
  const blocked = relationships.filter(r => r.type === 'BLOCKED')

  const onlineFriends = friends.filter(r => {
    const s = presences[r.user.id]?.status
    return s && s !== 'offline' && s !== 'invisible'
  })

  const displayed = tab === 'online' ? onlineFriends : tab === 'all' ? friends : tab === 'pending' ? [...incoming, ...outgoing] : blocked

  const handleAddFriend = async () => {
    if (!addUsername.trim()) return
    setAddStatus('loading')
    try {
      const [username, discrim] = addUsername.split('#')
      await api.post(`/api/v1/users/@me/relationships/find`, { username, discriminator: discrim || undefined })
      setAddStatus('success')
      setAddMsg(`Friend request sent to ${addUsername}!`)
      setAddUsername('')
      // Re-fetch to immediately reflect pending outgoing request, then switch to Pending tab
      const rels = await api.get<Relationship[]>('/api/v1/users/@me/relationships')
      setRelationships(rels)
      setTimeout(() => setTab('pending'), 1500)
    } catch (err: any) {
      setAddStatus('error')
      setAddMsg(err.message || 'Could not send friend request')
    }
    setTimeout(() => setAddStatus('idle'), 3000)
  }

  const handleAccept = async (userId: string) => {
    await api.put(`/api/v1/users/@me/relationships/${userId}`, { type: 1 })
    const rels = await api.get<Relationship[]>('/api/v1/users/@me/relationships')
    setRelationships(rels)
  }

  const handleRemove = async (userId: string) => {
    await api.delete(`/api/v1/users/@me/relationships/${userId}`)
    const rels = await api.get<Relationship[]>('/api/v1/users/@me/relationships')
    setRelationships(rels)
  }

  const handleMessage = async (userId: string) => {
    const ch = await api.post<Channel>('/api/v1/users/@me/channels', { recipientId: userId })
    addDMChannel(ch)
    navigate(`/channels/@me/${ch.id}`)
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'online', label: 'Online' },
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', count: incoming.length || undefined },
    { key: 'blocked', label: 'Blocked' },
    { key: 'add', label: 'Add Friend' },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
        <UserPlus size={22} className="text-interactive-muted" />
        <span className="font-semibold text-white">Friends</span>
        <div className="w-px h-5 bg-white/[0.12]" />
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t.key ? 'bg-white/[0.12] text-white' : 'text-interactive-muted hover:text-interactive-hover hover:bg-white/[0.06]'
            } ${t.key === 'add' ? 'bg-success text-white hover:bg-success/80' : ''}`}
          >
            {t.label}
            {t.count ? <span className="bg-danger text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'add' ? (
          <div className="max-w-lg">
            <h2 className="text-white font-semibold mb-1">Add Friend</h2>
            <p className="text-text-muted text-sm mb-4">You can add a friend with their FreeCord username.</p>
            <div className="bg-bg-secondary rounded-lg p-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-bg-tertiary text-text-normal placeholder-interactive-muted rounded px-3 py-2 text-sm border-2 border-transparent focus:border-brand outline-none"
                  placeholder="Enter a Username"
                  value={addUsername}
                  onChange={e => setAddUsername(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                />
                <Button onClick={handleAddFriend} loading={addStatus === 'loading'} disabled={!addUsername.trim()}>
                  Send Friend Request
                </Button>
              </div>
              {addStatus !== 'idle' && (
                <p className={`mt-2 text-sm ${addStatus === 'success' ? 'text-success' : 'text-danger'}`}>{addMsg}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-text-muted">
                <div className="text-6xl">
                  {tab === 'online' ? '🟢' : tab === 'pending' ? '⏳' : tab === 'blocked' ? '🚫' : '👥'}
                </div>
                <p>{tab === 'online' ? 'No one is online right now' : tab === 'pending' ? 'No pending requests' : tab === 'blocked' ? 'No blocked users' : 'No friends yet'}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
                  {tab === 'online' ? 'Online' : tab === 'all' ? 'All Friends' : tab === 'pending' ? 'Pending' : 'Blocked'} — {displayed.length}
                </p>
                {displayed.map(rel => {
                  const status = presences[rel.user.id]?.status || 'offline'
                  const isIncoming = rel.type === 'PENDING_INCOMING'
                  const isOutgoing = rel.type === 'PENDING_OUTGOING'
                  const isBlocked = rel.type === 'BLOCKED'
                  return (
                    <div key={rel.user.id} className="flex items-center gap-3 py-3 border-b border-white/[0.06] group hover:bg-white/[0.03] rounded px-2 -mx-2 transition-colors">
                      <Avatar userId={rel.user.id} username={rel.user.username} avatarHash={rel.user.avatar} size={36} status={status} showStatus />
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{rel.user.username}</p>
                        <p className="text-text-muted text-xs capitalize">{isIncoming ? 'Incoming Request' : isOutgoing ? 'Outgoing Request' : isBlocked ? 'Blocked' : status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isIncoming && (
                          <>
                            <button onClick={() => handleAccept(rel.user.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-success/20 hover:bg-success text-success hover:text-white text-xs font-medium transition-colors">
                              <Check size={14} /> Accept
                            </button>
                            <button onClick={() => handleRemove(rel.user.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-secondary hover:bg-danger text-text-muted hover:text-white text-xs font-medium transition-colors">
                              <X size={14} /> Decline
                            </button>
                          </>
                        )}
                        {isOutgoing && (
                          <button onClick={() => handleRemove(rel.user.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-secondary hover:bg-danger text-text-muted hover:text-white text-xs font-medium transition-colors">
                            <X size={14} /> Cancel
                          </button>
                        )}
                        {isBlocked && (
                          <button onClick={() => handleRemove(rel.user.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-bg-secondary hover:bg-danger text-text-muted hover:text-white text-xs font-medium transition-colors">
                            <X size={14} /> Unblock
                          </button>
                        )}
                        {rel.type === 'FRIEND' && (
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleMessage(rel.user.id)} className="w-8 h-8 rounded-full bg-bg-secondary hover:bg-bg-floating flex items-center justify-center text-text-muted hover:text-white transition-colors">
                              <MessageSquare size={16} />
                            </button>
                            <button onClick={() => handleRemove(rel.user.id)} className="w-8 h-8 rounded-full bg-bg-secondary hover:bg-danger flex items-center justify-center text-text-muted hover:text-white transition-colors">
                              <UserMinus size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
