import { useEffect, useState } from 'react'
import { gateway } from '@/lib/gateway'

interface TypingUser { username: string; ts: number }

export function TypingIndicator({ channelId }: { channelId: string }) {
  const [typing, setTyping] = useState<Record<string, TypingUser>>({})

  useEffect(() => {
    const off = gateway.on('TYPING_START', (d: any) => {
      if (d.channelId !== channelId) return
      const name = d.member?.nick || d.user?.username || 'Someone'
      setTyping(p => ({ ...p, [d.userId]: { username: name, ts: Date.now() } }))
      setTimeout(() => setTyping(p => { const n = { ...p }; delete n[d.userId]; return n }), 10000)
    })
    return off
  }, [channelId])

  const users = Object.values(typing)
  if (!users.length) return <div className="h-6" />

  const names = users.map(u => u.username)
  const text = names.length === 1 ? `${names[0]} is typing...`
    : names.length <= 3 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are typing...`
    : 'Several people are typing...'

  return (
    <div className="h-6 flex items-center gap-1.5 px-4 text-xs text-text-muted flex-shrink-0">
      <span className="flex gap-0.5 items-end">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1 h-1 bg-text-muted rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }} />
        ))}
      </span>
      <span><strong className="text-text-normal">{text}</strong></span>
    </div>
  )
}
