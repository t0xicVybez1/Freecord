import { useState } from 'react'
import { CDNUtils } from '@/lib/cdn'
import { cn, stringToColor, getInitials, getStatusColor } from '@/lib/utils'

interface AvatarProps {
  userId: string
  username: string
  avatarHash?: string | null
  size?: number
  status?: string
  className?: string
  onClick?: () => void
  showStatus?: boolean
}

export function Avatar({ userId, username, avatarHash, size = 40, status, className, onClick, showStatus = false }: AvatarProps) {
  const [err, setErr] = useState(false)
  const url = !err && avatarHash ? CDNUtils.avatar(userId, avatarHash, size * 2) : null

  return (
    <div className={cn('relative flex-shrink-0', className)} style={{ width: size, height: size }} onClick={onClick}>
      <div
        className={cn('rounded-full overflow-hidden flex items-center justify-center font-bold text-white select-none',
          onClick && 'cursor-pointer hover:brightness-90 transition-all')}
        style={{ width: size, height: size, backgroundColor: url ? undefined : stringToColor(username), fontSize: size * 0.38 }}
      >
        {url
          ? <img src={url} alt={username} className="w-full h-full object-cover" onError={() => setErr(true)} />
          : getInitials(username)
        }
      </div>
      {showStatus && status && status !== 'invisible' && (
        <div
          className="absolute bottom-0 right-0 rounded-full border-2 border-bg-secondary"
          style={{ width: size * 0.32, height: size * 0.32, backgroundColor: getStatusColor(status), borderWidth: Math.max(2, size * 0.06) }}
        />
      )}
    </div>
  )
}
