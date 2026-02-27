import { useEffect, useRef, useCallback, useState } from 'react'
import { useMessagesStore } from '@/stores/messages'
import { useAuthStore } from '@/stores/auth'
import { MessageItem } from './MessageItem'
import { Hash, ArrowDown, CheckSquare, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import type { Message } from '@freecord/types'
import { format, isSameDay } from 'date-fns'

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 my-4 mx-4">
      <div className="flex-1 h-px bg-white/[0.08]" />
      <span className="text-xs font-semibold text-text-muted flex-shrink-0">
        {format(date, 'MMMM d, yyyy')}
      </span>
      <div className="flex-1 h-px bg-white/[0.08]" />
    </div>
  )
}

export function MessageList({ channelId, onReply, jumpToMessageId }: { channelId: string; onReply?: (msg: Message) => void; jumpToMessageId?: string }) {
  const { getMessages, getChannelState, setMessages, prependMessages, setLoading, removeMessages } = useMessagesStore()
  const messages = getMessages(channelId)
  const state = getChannelState(channelId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [newMsgCount, setNewMsgCount] = useState(0)
  const [highlightId, setHighlightId] = useState<string | undefined>()
  const isAtBottom = useRef(true)

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const myId = useAuthStore(s => s.user?.id)

  // Load initial messages
  useEffect(() => {
    if (state?.orderedIds.length) return
    setLoading(channelId, true)
    api.get<Message[]>(`/api/v1/channels/${channelId}/messages?limit=50`)
      .then(msgs => setMessages(channelId, msgs.reverse(), msgs.length >= 50))
      .catch(() => setLoading(channelId, false))
  }, [channelId])

  // Reset selection when channel changes
  useEffect(() => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }, [channelId])

  // Jump to message by ID
  useEffect(() => {
    if (!jumpToMessageId) return
    const el = document.getElementById(`msg-${jumpToMessageId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightId(jumpToMessageId)
      setTimeout(() => setHighlightId(undefined), 2000)
    }
  }, [jumpToMessageId])

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      setNewMsgCount(0)
    } else {
      setNewMsgCount(c => c + 1)
    }
  }, [messages.length])

  // Scroll handler
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isAtBottom.current = atBottom
    setShowScrollBtn(!atBottom)
    if (atBottom) setNewMsgCount(0)

    // Load more when near top
    if (el.scrollTop < 100 && state?.hasMore && !state.isLoading && messages.length > 0) {
      const oldest = messages[0]
      setLoading(channelId, true)
      const prevHeight = el.scrollHeight
      api.get<Message[]>(`/api/v1/channels/${channelId}/messages?limit=50&before=${oldest.id}`)
        .then(older => {
          prependMessages(channelId, older.reverse())
          requestAnimationFrame(() => {
            if (el) el.scrollTop = el.scrollHeight - prevHeight
          })
        })
        .catch(() => setLoading(channelId, false))
    }
  }, [channelId, messages, state])

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setNewMsgCount(0)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size < 1) return
    const ids = [...selectedIds]
    setBulkDeleting(true)
    try {
      if (ids.length === 1) {
        await api.delete(`/api/v1/channels/${channelId}/messages/${ids[0]}`)
        removeMessages(channelId, ids)
      } else {
        await api.post(`/api/v1/channels/${channelId}/messages/bulk-delete`, { messages: ids })
        removeMessages(channelId, ids)
      }
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch {}
    setBulkDeleting(false)
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  if (state?.isLoading && !messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!messages.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-3 px-8">
        <div className="w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center">
          <Hash size={32} className="text-interactive-muted" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xl">Welcome!</p>
          <p className="text-sm mt-1">This is the beginning of this channel's history.</p>
        </div>
      </div>
    )
  }

  // Group messages (consecutive from same author within 7 min)
  const grouped: { message: Message; isGrouped: boolean }[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    const isGrouped = !!(prev &&
      prev.author?.id === msg.author?.id &&
      !prev.referencedMessage &&
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 7 * 60 * 1000 &&
      prev.type === msg.type
    )
    grouped.push({ message: msg, isGrouped })
  })

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Select Mode Toolbar */}
      {selectMode && (
        <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border-b border-black/20 flex-shrink-0">
          <button onClick={exitSelectMode} className="text-text-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
          <span className="text-sm text-text-muted flex-1">
            {selectedIds.size} message{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1 bg-danger hover:bg-danger/80 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </button>
          )}
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="h-full overflow-y-auto px-4 py-2" onScroll={handleScroll}>
          {state?.isLoading && messages.length > 0 && (
            <div className="flex justify-center py-3">
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!state?.hasMore && messages.length > 0 && (
            <div className="py-8 text-center text-text-muted text-sm">
              <Hash size={40} className="mx-auto mb-2 text-interactive-muted" />
              <p className="font-semibold text-white text-lg">Beginning of message history</p>
              {!selectMode && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-text-muted hover:text-white transition-colors"
                >
                  <CheckSquare size={14} />
                  Select Messages
                </button>
              )}
            </div>
          )}
          {grouped.map(({ message, isGrouped }, i) => {
            const prevMsg = i > 0 ? grouped[i-1].message : null
            const showDate = !prevMsg || !isSameDay(new Date(message.createdAt), new Date(prevMsg.createdAt))
            const isHighlighted = highlightId === message.id
            const isSelected = selectedIds.has(message.id)
            return (
              <div
                key={message.id}
                id={`msg-${message.id}`}
                className={`relative group/select ${isHighlighted ? 'animate-pulse bg-yellow-500/10 rounded transition-colors' : ''} ${isSelected ? 'bg-brand/10 rounded' : ''}`}
              >
                {showDate && <DateSeparator date={new Date(message.createdAt)} />}
                <div className="flex items-start">
                  {selectMode && (
                    <div className="flex-shrink-0 flex items-center justify-center w-10 h-11">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(message.id)}
                        className="w-4 h-4 rounded accent-brand cursor-pointer"
                      />
                    </div>
                  )}
                  <div
                    className="flex-1 min-w-0"
                    onClick={selectMode ? () => toggleSelect(message.id) : undefined}
                  >
                    <MessageItem
                      message={message}
                      isGrouped={isGrouped}
                      onReply={selectMode ? () => {} : (onReply ?? (() => {}))}
                      selectMode={selectMode}
                    />
                  </div>
                </div>
                {/* Select mode entry per message (hover button) */}
                {!selectMode && (message.author?.id === myId) && (
                  <button
                    onClick={() => { setSelectMode(true); toggleSelect(message.id) }}
                    className="absolute right-2 top-1 opacity-0 group-hover/select:opacity-100 transition-opacity text-text-muted hover:text-white p-1 rounded"
                    title="Select message"
                  >
                    <CheckSquare size={14} />
                  </button>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 bg-bg-secondary hover:bg-bg-floating text-white rounded-full p-2 shadow-lg transition-colors flex items-center gap-2 text-sm"
          >
            {newMsgCount > 0 && <span className="bg-brand text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{newMsgCount}</span>}
            <ArrowDown size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
