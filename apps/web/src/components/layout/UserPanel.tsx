import { useAuthStore } from '@/stores/auth'
import { useVoiceStore } from '@/stores/voice'
import { useUIStore } from '@/stores/ui'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { Mic, MicOff, Headphones, HeadphoneOff, Settings } from 'lucide-react'

export function UserPanel() {
  const user = useAuthStore(s => s.user)
  const { selfMute, selfDeaf, setSelfMute, setSelfDeaf } = useVoiceStore()
  const openModal = useUIStore(s => s.openModal)
  if (!user) return null

  return (
    <div className="flex items-center gap-2 px-2 py-2 bg-bg-tertiary border-t border-black/20 flex-shrink-0">
      <Avatar
        userId={user.id} username={user.username} avatarHash={user.avatar}
        size={32} status={user.status} showStatus className="cursor-pointer"
        onClick={() => openModal({ type: 'USER_PROFILE', data: { userId: user.id } })}
      />
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
