import { useUIStore } from '@/stores/ui'
import { UserSettingsModal } from '@/components/modals/UserSettings'
import { GuildSettingsModal } from '@/components/modals/GuildSettings'
import { CreateGuildModal } from '@/components/modals/CreateGuild'
import { CreateChannelModal } from '@/components/modals/CreateChannel'
import { InviteModal } from '@/components/modals/InviteModal'
import { UserProfileModal } from '@/components/modals/UserProfile'

export function ModalRenderer() {
  const { modals, closeModal } = useUIStore()
  if (!modals.length) return null
  const topModal = modals[modals.length - 1]
  const data = (topModal.data ?? {}) as Record<string, string>

  switch (topModal.type) {
    case 'USER_SETTINGS':
      return <UserSettingsModal onClose={closeModal} />
    case 'GUILD_SETTINGS':
      return <GuildSettingsModal guildId={data.guildId} onClose={closeModal} />
    case 'CREATE_GUILD':
      return <CreateGuildModal onClose={closeModal} />
    case 'CREATE_CHANNEL':
      return <CreateChannelModal guildId={data.guildId} categoryId={data.categoryId} onClose={closeModal} />
    case 'INVITE':
      return <InviteModal guildId={data.guildId} channelId={data.channelId} onClose={closeModal} />
    case 'USER_PROFILE':
      return <UserProfileModal userId={data.userId} onClose={closeModal} />
    default: return null
  }
}
