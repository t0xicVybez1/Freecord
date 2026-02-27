import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthLayout } from './components/layout/AuthLayout'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import FriendsPage from './pages/app/Friends'
import GuildChannelPage from './pages/app/GuildChannel'
import DirectMessagePage from './pages/app/DirectMessage'
import HomePage from './pages/app/Home'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/channels/@me" replace /> },
      {
        path: 'channels/@me',
        element: <HomePage />,
        children: [
          { index: true, element: <FriendsPage /> },
          { path: ':dmChannelId', element: <DirectMessagePage /> },
        ],
      },
      { path: 'channels/:guildId/:channelId', element: <GuildChannelPage /> },
    ],
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: '/register',
    element: <AuthLayout />,
    children: [{ index: true, element: <RegisterPage /> }],
  },
])
