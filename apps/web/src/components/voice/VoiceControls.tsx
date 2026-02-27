import { useVoiceStore } from '@/stores/voice'
import { useChannelsStore } from '@/stores/channels'
import { useGuildsStore } from '@/stores/guilds'
import { Tooltip } from '@/components/ui/Tooltip'
import { Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff, Monitor, PhoneOff, Settings } from 'lucide-react'

export function VoiceControls() {
  const { channelId, guildId, selfMute, selfDeaf, selfVideo, selfStream, leaveChannel, setSelfMute, setSelfDeaf } = useVoiceStore()
  const channel = useChannelsStore(s => channelId ? s.getChannel(channelId) : undefined)
  const guild = useGuildsStore(s => guildId ? s.guilds[guildId] : undefined)

  if (!channelId) return null

  return (
    <div className="bg-green-900/30 border-b border-success/30 px-3 py-2 flex items-center justify-between flex-shrink-0">
      <div className="flex flex-col">
        <span className="text-success text-xs font-semibold">Voice Connected</span>
        <span className="text-text-muted text-xs">{channel?.name} {guild ? `· ${guild.name}` : ''}</span>
      </div>
      <div className="flex items-center gap-1">
        <Tooltip content={selfMute ? 'Unmute' : 'Mute'}>
          <button onClick={() => setSelfMute(!selfMute)}
            className={`p-1.5 rounded transition-colors ${selfMute ? 'text-danger hover:bg-danger/20' : 'text-text-muted hover:bg-white/[0.06] hover:text-white'}`}>
            {selfMute ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        </Tooltip>
        <Tooltip content={selfDeaf ? 'Undeafen' : 'Deafen'}>
          <button onClick={() => setSelfDeaf(!selfDeaf)}
            className={`p-1.5 rounded transition-colors ${selfDeaf ? 'text-danger hover:bg-danger/20' : 'text-text-muted hover:bg-white/[0.06] hover:text-white'}`}>
            {selfDeaf ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
          </button>
        </Tooltip>
        <Tooltip content="Disconnect">
          <button onClick={() => leaveChannel()}
            className="p-1.5 rounded text-danger hover:bg-danger/20 transition-colors">
            <PhoneOff size={16} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
