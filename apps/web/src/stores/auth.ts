import { create } from 'zustand'
import type { PrivateUser, UserSettings } from '@freecord/types'
import api, { setAccessToken } from '@/lib/api'
import { gateway } from '@/lib/gateway'
import { useGuildsStore } from './guilds'

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000'

/** Register a handler so the gateway can silently refresh an expired access token. */
function setupTokenRefresh(set: (s: Partial<{ isAuthenticated: boolean }>) => void) {
  gateway.setInvalidSessionHandler(async () => {
    try {
      const r = await fetch(`${API_URL()}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        setAccessToken(data.token)
        gateway.connect(data.token) // connect() resets intentionalClose and reconnects
      } else {
        set({ isAuthenticated: false })
      }
    } catch {
      set({ isAuthenticated: false })
    }
  })
}

interface AuthState {
  user: PrivateUser | null
  settings: UserSettings | null
  isAuthenticated: boolean
  isLoading: boolean
  initialize: () => Promise<void>
  login: (email: string, password: string, code?: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<PrivateUser>) => void
  updateSettings: (data: Partial<UserSettings>) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  settings: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    set({ isLoading: true })
    try {
      const r = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (r.ok) {
        const data = await r.json()
        setAccessToken(data.token)
        const [user, settings] = await Promise.all([
          api.get<PrivateUser>('/api/v1/users/@me'),
          api.get<UserSettings>('/api/v1/users/@me/settings').catch(() => null),
        ])
        set({ user, settings, isAuthenticated: true })
        gateway.connect(data.token)
        setupTokenRefresh(set)
        api.get<any[]>('/api/v1/users/@me/guilds').then(guilds => {
          if (guilds?.length) useGuildsStore.getState().setGuilds(guilds)
        }).catch(() => {})
      } else { set({ isAuthenticated: false }) }
    } catch { set({ isAuthenticated: false }) }
    finally { set({ isLoading: false }) }
  },

  login: async (email, password, code) => {
    const data = await api.post<{ token: string; user: PrivateUser }>('/api/v1/auth/login', { email, password, ...(code ? { code } : {}) })
    setAccessToken(data.token)
    const settings = await api.get<UserSettings>('/api/v1/users/@me/settings').catch(() => null)
    set({ user: data.user, settings, isAuthenticated: true })
    gateway.connect(data.token)
    setupTokenRefresh(set)
    api.get<any[]>('/api/v1/users/@me/guilds').then(guilds => {
      if (guilds?.length) useGuildsStore.getState().setGuilds(guilds)
    }).catch(() => {})
  },

  register: async (username, email, password) => {
    const data = await api.post<{ token: string; user: PrivateUser }>('/api/v1/auth/register', { username, email, password })
    setAccessToken(data.token)
    const settings = await api.get<UserSettings>('/api/v1/users/@me/settings').catch(() => null)
    set({ user: data.user, settings, isAuthenticated: true })
    gateway.connect(data.token)
    setupTokenRefresh(set)
    api.get<any[]>('/api/v1/users/@me/guilds').then(guilds => {
      if (guilds?.length) useGuildsStore.getState().setGuilds(guilds)
    }).catch(() => {})
  },

  logout: async () => {
    try { await api.post('/api/v1/auth/logout') } catch {}
    gateway.disconnect()
    setAccessToken(null)
    set({ user: null, settings: null, isAuthenticated: false })
  },

  updateUser: (data) => set(s => ({ user: s.user ? { ...s.user, ...data } : null })),
  updateSettings: (data) => set(s => ({ settings: s.settings ? { ...s.settings, ...data } : null })),
}))
