import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { formatMessageDate } from '@/lib/utils'
import { renderMarkdown } from '@freecord/markdown'
import type { Message } from '@freecord/types'

interface SearchPanelProps {
  channelId: string
  channelName: string
  onClose: () => void
  onJumpTo: (messageId: string) => void
}

export function SearchPanel({ channelId, channelName, onClose, onJumpTo }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const doSearch = (q: string) => {
    if (!q.trim()) { setResults([]); setTotal(0); return }
    setLoading(true)
    api.get<{ messages: Message[]; total: number }>(
      `/api/v1/channels/${channelId}/messages/search?q=${encodeURIComponent(q)}&limit=25`
    ).then(r => {
      setResults(r.messages)
      setTotal(r.total)
    }).catch(() => {}).finally(() => setLoading(false))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 400)
  }

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return text.replace(regex, '<mark class="bg-yellow-400/30 text-yellow-200 rounded px-0.5">$1</mark>')
  }

  return (
    <div className="w-80 flex-shrink-0 bg-bg-secondary flex flex-col border-l border-black/20">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-black/20 flex-shrink-0">
        <Search size={16} className="text-interactive-muted flex-shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-text-normal text-sm outline-none placeholder-interactive-muted"
          placeholder={`Search #${channelName}`}
          value={query}
          onChange={handleChange}
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
        <button onClick={onClose} className="text-interactive-muted hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-text-muted text-sm">Searching...</div>
        )}
        {!loading && query.trim() && results.length === 0 && (
          <div className="p-4 text-center text-text-muted text-sm">
            No results for "{query}"
          </div>
        )}
        {!loading && results.length > 0 && (
          <>
            <div className="px-3 py-2 text-xs text-text-muted font-semibold uppercase tracking-wide border-b border-black/10">
              {total} result{total !== 1 ? 's' : ''}
            </div>
            {results.map(msg => (
              <button
                key={msg.id}
                className="w-full text-left px-3 py-3 hover:bg-white/[0.04] border-b border-black/10 transition-colors group"
                onClick={() => { onJumpTo(msg.id); onClose(); }}
              >
                <div className="flex items-start gap-2">
                  <Avatar userId={msg.author?.id ?? ''} username={msg.author?.username ?? ''} avatarHash={msg.author?.avatar ?? null} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-text-header truncate">{msg.author?.username}</span>
                      <span className="text-[10px] text-text-muted flex-shrink-0">{formatMessageDate(new Date(msg.createdAt))}</span>
                    </div>
                    <div
                      className="text-xs text-text-muted leading-relaxed line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: highlight(renderMarkdown(msg.content), query) }}
                    />
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                  Jump to message
                </div>
              </button>
            ))}
          </>
        )}
        {!query.trim() && (
          <div className="p-6 text-center text-text-muted">
            <Search size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">Search messages in this channel</p>
            <p className="text-xs mt-1 opacity-60">Type to search by content</p>
          </div>
        )}
      </div>
    </div>
  )
}
