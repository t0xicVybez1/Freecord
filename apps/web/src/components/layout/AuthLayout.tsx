import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (!isLoading && isAuthenticated) return <Navigate to="/channels/@me" replace />
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 40%, #2b2d31 100%)' }}>
      <Outlet />
    </div>
  )
}
