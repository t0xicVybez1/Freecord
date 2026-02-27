import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useChannelsStore } from '@/stores/channels'
import { useGuildsStore } from '@/stores/guilds'
import { ChannelSidebar } from '@/components/layout/ChannelSidebar'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { MemberList } from '@/components/layout/MemberList'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { SearchPanel } from '@/components/chat/SearchPanel'
import { VoiceControls } from '@/components/voice/VoiceControls'
import { useUIStore } from '@/stores/ui'
import { useVoiceStore } from '@/stores/voice'
import { Hash, Volume2, Users, Bell, Pin, Search, Inbox, HelpCircle, Lock, Megaphone } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { ChannelType } from '@freecord/types'
import type { Message } from '@freecord/types'

export default function GuildChannelPage() {
  const { guildId, channelId } = useParams<{ guildId: string; channelId: string }>()
  const getChannel = useChannelsStore(s => s.getChannel)
  const getGuild = useGuildsStore(s => s.getGuild)
  const { activeMemberListPanel, toggleMemberList } = useUIStore()
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [jumpToId, setJumpToId] = useState<string | undefined>()
  const currentVoiceId = useVoiceStore(s => s.channelId)

  const channel = channelId ? getChannel(channelId) : null
  const guild = guildId ? getGuild(guildId) : null

  if (!guildId) return null

  if (!channel || !channelId) {
    return (
      <>
        <ChannelSidebar guildId={guildId} />
        <div className="flex flex-col flex-1 items-center justify-center text-text-muted gap-3">
          <div className="text-6xl">👈</div>
          <p className="text-lg font-medium">Select a channel to start chatting</p>
        </div>
      </>
    )
  }

  const isVoice = channel.type === ChannelType.GUILD_VOICE || channel.type === ChannelType.GUILD_STAGE_VOICE
  const ChannelIcon = isVoice ? Volume2 : channel.type === ChannelType.GUILD_ANNOUNCEMENT ? Megaphone : channel.nsfw ? Lock : Hash

  const handleJumpTo = (messageId: string) => {
    setJumpToId(messageId)
    // Clear after a moment so it can be re-triggered
    setTimeout(() => setJumpToId(undefined), 1000)
  }

  return (
    <>
      <ChannelSidebar guildId={guildId} />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Channel header */}
        <div className="flex items-center gap-2 px-4 h-12 border-b border-black/20 shadow-sm flex-shrink-0">
          <ChannelIcon size={20} className="text-interactive-muted flex-shrink-0" />
          <span className="font-semibold text-white">{channel.name}</span>
          {channel.topic && (
            <><div className="w-px h-5 bg-white/[0.12] mx-1 flex-shrink-0" />
            <span className="text-sm text-text-muted truncate">{channel.topic}</span></>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Tooltip content="Threads"><button className="p-1.5 text-interactive-normal hover:text-white"><Hash size={20} /></button></Tooltip>
            <Tooltip content={activeMemberListPanel ? 'Hide Members' : 'Show Members'}>
              <button onClick={toggleMemberList} className={`p-1.5 transition-colors ${activeMemberListPanel ? 'text-white' : 'text-interactive-normal hover:text-white'}`}>
                <Users size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Search Messages">
              <button
                onClick={() => setShowSearch(v => !v)}
                className={`p-1.5 transition-colors ${showSearch ? 'text-white' : 'text-interactive-normal hover:text-white'}`}
              >
                <Search size={20} />
              </button>
            </Tooltip>
            <Tooltip content="Inbox"><button className="p-1.5 text-interactive-normal hover:text-white"><Inbox size={20} /></button></Tooltip>
            <Tooltip content="Help"><button className="p-1.5 text-interactive-normal hover:text-white"><HelpCircle size={20} /></button></Tooltip>
          </div>
        </div>

        {currentVoiceId && <VoiceControls />}

        {/* Chat area */}
        {!isVoice && (
          <div className="flex flex-1 overflow-hidden min-w-0">
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <MessageList channelId={channelId} onReply={setReplyTo} jumpToMessageId={jumpToId} />
              <TypingIndicator channelId={channelId} />
              <MessageInput channelId={channelId} channelName={channel.name || 'channel'} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
            </div>
            {activeMemberListPanel && guild && <MemberList guildId={guildId} />}
            {showSearch && (
              <SearchPanel
                channelId={channelId}
                channelName={channel.name}
                onClose={() => setShowSearch(false)}
                onJumpTo={handleJumpTo}
              />
            )}
          </div>
        )}

        {isVoice && (
          <div className="flex flex-1 items-center justify-center text-text-muted flex-col gap-4">
            <Volume2 size={48} />
            <p className="text-xl font-semibold text-white">{channel.name}</p>
            <p>Join a voice channel to start chatting</p>
          </div>
        )}
      </div>
    </>
  )
}
