import { create } from 'zustand'
import type { User, Relationship, PresenceUpdate } from '@freecord/types'

interface UsersState {
  users: Record<string, User>
  presences: Record<string, PresenceUpdate>
  relationships: Relationship[]
  getUser: (id: string) => User | undefined
  getPresence: (id: string) => PresenceUpdate | undefined
  setUser: (user: User) => void
  setUsers: (users: User[]) => void
  setPresence: (userId: string, data: Partial<PresenceUpdate>) => void
  setRelationships: (rels: Relationship[]) => void
  addRelationship: (rel: Relationship) => void
  removeRelationship: (userId: string) => void
  getFriends: () => Relationship[]
  getPending: () => Relationship[]
  reset: () => void
}

export const useUsersStore = create<UsersState>((set, get) => ({
  users: {},
  presences: {},
  relationships: [],

  getUser: (id) => get().users[id],
  getPresence: (id) => get().presences[id],

  setUser: (user) => set(s => ({ users: { ...s.users, [user.id]: user } })),
  setUsers: (users) => set(s => ({ users: { ...s.users, ...Object.fromEntries(users.map(u => [u.id, u])) } })),

  setPresence: (userId, data) => set(s => ({
    presences: { ...s.presences, [userId]: { ...s.presences[userId], ...data, userId } as PresenceUpdate },
  })),

  setRelationships: (rels) => set({ relationships: rels }),

  addRelationship: (rel) => set(s => ({
    relationships: [...s.relationships.filter(r => r.user.id !== rel.user.id), rel],
  })),

  removeRelationship: (userId) => set(s => ({ relationships: s.relationships.filter(r => r.user.id !== userId) })),

  getFriends: () => get().relationships.filter(r => r.type === 'FRIEND'),
  getPending: () => get().relationships.filter(r => r.type === 'PENDING_INCOMING' || r.type === 'PENDING_OUTGOING'),

  reset: () => set({ users: {}, presences: {}, relationships: [] }),
}))
