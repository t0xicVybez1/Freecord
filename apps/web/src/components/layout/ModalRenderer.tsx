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

  switch (topModal.type) {
    case 'USER_SETTINGS':     return <UserSettingsModal isOpen onClose={closeModal} />
    case 'GUILD_SETTINGS':    return <GuildSettingsModal isOpen onClose={closeModal} data={topModal.data as any} />
    case 'CREATE_GUILD':      return <CreateGuildModal isOpen onClose={closeModal} />
    case 'CREATE_CHANNEL':    return <CreateChannelModal isOpen onClose={closeModal} data={topModal.data as any} />
    case 'INVITE':            return <InviteModal isOpen onClose={closeModal} data={topModal.data as any} />
    case 'USER_PROFILE':      return <UserProfileModal isOpen onClose={closeModal} data={topModal.data as any} />
    default: return null
  }
}
