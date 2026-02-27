import { create } from 'zustand'
import type { PrivateUser, UserSettings } from '@freecord/types'
import api, { setAccessToken } from '@/lib/api'
import { gateway } from '@/lib/gateway'
import { useGuildsStore } from './guilds'
import { useChannelsStore } from './channels'
import type { Channel } from '@freecord/types'

const API_URL = () => import.meta.env.VITE_API_URL || 'http://localhost:3000'

let _preloading = false

/** Preload guilds + their channels from REST API so the sidebar works even if READY is slow. */
async function preloadGuildsAndChannels() {
  if (_preloading) return
  _preloading = true
  try {
    const guilds = await api.get<any[]>('/api/v1/users/@me/guilds')
    if (!guilds?.length) return
    useGuildsStore.getState().setGuilds(guilds)
    // Fetch channels for all guilds sequentially to avoid flooding the API
    for (const g of guilds) {
      await api.get<Channel[]>(`/api/v1/guilds/${g.id}/channels`)
        .then(channels => { if (channels?.length) useChannelsStore.getState().setGuildChannels(g.id, channels) })
        .catch(() => {})
    }
  } catch {} finally {
    _preloading = false
  }
}

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
        preloadGuildsAndChannels()
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
    preloadGuildsAndChannels()
  },

  register: async (username, email, password) => {
    const data = await api.post<{ token: string; user: PrivateUser }>('/api/v1/auth/register', { username, email, password })
    setAccessToken(data.token)
    const settings = await api.get<UserSettings>('/api/v1/users/@me/settings').catch(() => null)
    set({ user: data.user, settings, isAuthenticated: true })
    gateway.connect(data.token)
    setupTokenRefresh(set)
    preloadGuildsAndChannels()
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
