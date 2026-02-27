import { useAuthStore } from '@/stores/auth'
import { useVoiceStore } from '@/stores/voice'
import { useUIStore } from '@/stores/ui'
import { useUsersStore } from '@/stores/users'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { api } from '@/lib/api'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, Headphones, HeadphoneOff, Settings, Circle, Shield } from 'lucide-react'
import type { PrivateUser } from '@freecord/types'
import { UserStatus } from '@freecord/types'

const STATUS_OPTIONS: { value: UserStatus; label: string; color: string }[] = [
  { value: UserStatus.ONLINE, label: 'Online', color: '#23a55a' },
  { value: UserStatus.IDLE, label: 'Idle', color: '#f0b132' },
  { value: UserStatus.DND, label: 'Do Not Disturb', color: '#f23f43' },
  { value: UserStatus.INVISIBLE, label: 'Invisible', color: '#80848e' },
]

export function UserPanel() {
  const user = useAuthStore(s => s.user)
  const updateUser = useAuthStore(s => s.updateUser)
  const setPresence = useUsersStore(s => s.setPresence)
  const { selfMute, selfDeaf, setSelfMute, setSelfDeaf } = useVoiceStore()
  const { openModal, openContextMenu } = useUIStore()
  const navigate = useNavigate()
  if (!user) return null
  const isStaff = (user as any).isStaff === true

  const handleStatusMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    openContextMenu(e.clientX, e.clientY, STATUS_OPTIONS.map(opt => ({
      label: opt.label,
      icon: <Circle size={10} fill={opt.color} color={opt.color} />,
      onClick: async () => {
        try {
          const updated = await api.patch<PrivateUser>('/api/v1/users/@me', { status: opt.value })
          updateUser({ status: updated.status })
          if (user) setPresence(user.id, { userId: user.id, status: updated.status as any })
        } catch {}
      },
    })))
  }

  return (
    <div className="flex items-center gap-2 px-2 py-2 bg-bg-tertiary border-t border-black/20 flex-shrink-0">
      <div className="relative cursor-pointer flex-shrink-0" onClick={handleStatusMenu}>
        <Avatar
          userId={user.id} username={user.username} avatarHash={user.avatar}
          size={32} status={user.status} showStatus
        />
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openModal({ type: 'USER_SETTINGS' })}>
        <p className="text-sm font-semibold text-white truncate leading-tight">{user.username}</p>
        <p className="text-xs text-text-muted truncate leading-tight">
          {user.customStatus || `#${user.discriminator}`}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        <Tooltip content={selfMute ? 'Unmute' : 'Mute'}>
          <button onClick={() => setSelfMute(!selfMute)}
            className={`p-1.5 rounded transition-colors ${selfMute ? 'text-danger hover:bg-danger/20' : 'text-interactive-normal hover:bg-white/[0.06] hover:text-white'}`}>
            {selfMute ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </Tooltip>
        <Tooltip content={selfDeaf ? 'Undeafen' : 'Deafen'}>
          <button onClick={() => setSelfDeaf(!selfDeaf)}
            className={`p-1.5 rounded transition-colors ${selfDeaf ? 'text-danger hover:bg-danger/20' : 'text-interactive-normal hover:bg-white/[0.06] hover:text-white'}`}>
            {selfDeaf ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
          </button>
        </Tooltip>
        {isStaff && (
          <Tooltip content="Staff Portal">
            <button onClick={() => navigate('/admin')}
              className="p-1.5 rounded text-warning hover:bg-warning/10 transition-colors">
              <Shield size={18} />
            </button>
          </Tooltip>
        )}
        <Tooltip content="User Settings">
          <button onClick={() => openModal({ type: 'USER_SETTINGS' })}
            className="p-1.5 rounded text-interactive-normal hover:bg-white/[0.06] hover:text-white transition-colors">
            <Settings size={18} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
