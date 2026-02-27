import { Outlet } from 'react-router-dom'
import { DMChannelList } from '@/components/layout/DMChannelList'
export default function HomePage() {
  return (
    <div className="flex flex-1 overflow-hidden min-w-0">
      <DMChannelList />
      <div className="flex-1 overflow-hidden min-w-0"><Outlet /></div>
    </div>
  )
}
