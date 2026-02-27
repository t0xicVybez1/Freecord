import { useParams } from 'react-router-dom'
import { useChannelsStore } from '@/stores/channels'
import { useAuthStore } from '@/stores/auth'
import { useUsersStore } from '@/stores/users'
import { MessageList } from '@/components/chat/MessageList'
import { MessageInput } from '@/components/chat/MessageInput'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import { Avatar } from '@/components/ui/Avatar'
import { ChannelType } from '@freecord/types'

export default function DirectMessagePage() {
  const { dmChannelId } = useParams<{ dmChannelId: string }>()
  const getChannel = useChannelsStore(s => s.getChannel)
  const myId = useAuthStore(s => s.user?.id)
  const presences = useUsersStore(s => s.presences)

  const channel = dmChannelId ? getChannel(dmChannelId) : null
  if (!channel || !dmChannelId) return (
    <div className="flex flex-1 items-center justify-center text-text-muted">Select a conversation</div>
  )

  const isGroup = channel.type === ChannelType.GROUP_DM
  const recipient = channel.recipients?.find(r => r.id !== myId)
  const name = isGroup ? (channel.name || channel.recipients?.map(r => r.username).join(', ') || 'Group DM') : (recipient?.username || 'Unknown')
  const status = recipient ? presences[recipient.id]?.status : undefined

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-w-0">
      {/* DM header */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-black/20 shadow-sm flex-shrink-0">
        {recipient && (
          <Avatar userId={recipient.id} username={recipient.username} avatarHash={recipient.avatar}
            size={24} status={status} showStatus />
        )}
        <span className="font-semibold text-white">{name}</span>
        {status && <span className="text-text-muted text-sm capitalize">{status}</span>}
      </div>

      {/* Messages */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <MessageList channelId={dmChannelId} />
        <TypingIndicator channelId={dmChannelId} />
        <MessageInput channelId={dmChannelId} channelName={name} />
      </div>
    </div>
  )
}
