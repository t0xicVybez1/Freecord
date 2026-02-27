import { useState, useEffect } from 'react'
import { Pin, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { formatMessageDate } from '@/lib/utils'
import { renderMarkdown } from '@freecord/markdown'
import type { Message } from '@freecord/types'

interface PinnedMessagesPanelProps {
  channelId: string
  onClose: () => void
}

export function PinnedMessagesPanel({ channelId, onClose }: PinnedMessagesPanelProps) {
  const [pins, setPins] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<Message[]>(`/api/v1/channels/${channelId}/pins`)
      .then(setPins)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [channelId])

  const handleUnpin = async (messageId: string) => {
    try {
      await api.delete(`/api/v1/channels/${channelId}/pins/${messageId}`)
      setPins(p => p.filter(m => m.id !== messageId))
    } catch {}
  }

  return (
    <div className="w-80 flex-shrink-0 bg-bg-secondary flex flex-col border-l border-black/20">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/20 flex-shrink-0">
        <Pin size={16} className="text-interactive-muted" />
        <span className="text-text-header font-semibold text-sm flex-1">Pinned Messages</span>
        <button onClick={onClose} className="text-interactive-muted hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-text-muted text-sm">Loading...</div>}
        {!loading && pins.length === 0 && (
          <div className="p-6 text-center text-text-muted">
            <Pin size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No pins yet</p>
            <p className="text-xs mt-1 opacity-60">Pin important messages to keep them accessible.</p>
          </div>
        )}
        {pins.map(msg => (
          <div key={msg.id} className="px-3 py-3 border-b border-black/10 group hover:bg-white/[0.03] transition-colors">
            <div className="flex items-start gap-2 mb-2">
              <Avatar userId={msg.author.id} username={msg.author.username} avatarHash={msg.author.avatar} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium text-text-header">{msg.author.displayName || msg.author.username}</span>
                  <span className="text-[10px] text-text-muted">{formatMessageDate(new Date(msg.createdAt))}</span>
                </div>
                <div
                  className="text-xs text-text-muted leading-relaxed mt-0.5 line-clamp-4"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                />
                {msg.attachments && msg.attachments.length > 0 && (
                  <p className="text-xs text-brand mt-0.5">📎 {msg.attachments.length} attachment{msg.attachments.length !== 1 ? 's' : ''}</p>
                )}
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all flex-shrink-0"
                onClick={() => handleUnpin(msg.id)}
                title="Unpin message"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
