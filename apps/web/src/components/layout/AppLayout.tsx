import { Outlet } from 'react-router-dom'
import { GuildSidebar } from './GuildSidebar'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { ModalRenderer } from './ModalRenderer'
import { useGateway } from '@/hooks/useGateway'

export function AppLayout() {
  useGateway()
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <GuildSidebar />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <Outlet />
      </div>
      <ContextMenu />
      <ModalRenderer />
    </div>
  )
}
