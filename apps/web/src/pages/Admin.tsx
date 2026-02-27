import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import {
  BarChart3, Users, Server, MessageSquare, Shield, Search, Trash2,
  Ban, Check, X, ChevronLeft, ChevronRight, RefreshCw, LogOut,
  Eye, Crown, AlertTriangle, Activity
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number
  totalGuilds: number
  totalMessages: number
  totalChannels: number
  onlineUsers: number
  newUsersToday: number
  newGuildsToday: number
}

interface AdminUser {
  id: string
  username: string
  email: string
  avatar: string | null
  verified: boolean
  isStaff: boolean
  bot: boolean
  flags: number
  createdAt: string
}

interface AdminGuild {
  id: string
  name: string
  icon: string | null
  description: string | null
  memberCount: number
  channelCount: number
  ownerId: string
  ownerUsername: string
  createdAt: string
}

interface AuditEntry {
  id: string
  guildId: string | null
  userId: string
  username: string | null
  actionType: string
  targetId: string | null
  reason: string | null
  createdAt: string
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: number | string; sub?: string; icon: any; color: string
}) {
  return (
    <div className="bg-bg-secondary rounded-xl p-5 flex items-start gap-4">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', color)}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-text-muted text-xs font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-text-muted text-xs mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-bg-primary rounded-xl p-6 w-96 shadow-2xl animate-scale-in">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={24} className="text-warning flex-shrink-0" />
          <p className="text-text-header font-semibold">Confirm Action</p>
        </div>
        <p className="text-text-muted text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-bg-secondary text-text-muted hover:text-white text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-danger text-white text-sm font-medium hover:bg-danger/80 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ─── Users Panel ──────────────────────────────────────────────────────────────

function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const LIMIT = 25

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<{ users: AdminUser[]; total: number }>(
        `/api/v1/admin/users?q=${encodeURIComponent(q)}&limit=${LIMIT}&offset=${offset}`
      )
      setUsers(r.users)
      setTotal(r.total)
    } catch {}
    setLoading(false)
  }, [q, offset])

  useEffect(() => { load() }, [load])

  const isBanned = (u: AdminUser) => (u.flags & 4) === 4

  const toggleBan = (u: AdminUser) => {
    const action = isBanned(u) ? 'unban' : 'ban'
    setConfirm({
      message: `Are you sure you want to ${action} @${u.username}?`,
      onConfirm: async () => {
        setConfirm(null)
        await api.patch(`/api/v1/admin/users/${u.id}`, { banned: !isBanned(u) })
        load()
      },
    })
  }

  const toggleStaff = (u: AdminUser) => {
    const action = u.isStaff ? 'remove staff from' : 'grant staff to'
    setConfirm({
      message: `Are you sure you want to ${action} @${u.username}?`,
      onConfirm: async () => {
        setConfirm(null)
        await api.patch(`/api/v1/admin/users/${u.id}`, { isStaff: !u.isStaff })
        load()
      },
    })
  }

  const deleteUser = (u: AdminUser) => {
    setConfirm({
      message: `Permanently delete account @${u.username}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        await api.delete(`/api/v1/admin/users/${u.id}`)
        setSelected(null)
        load()
      },
    })
  }

  const kickSessions = async (u: AdminUser) => {
    await api.post(`/api/v1/admin/users/${u.id}/kick-sessions`, {})
    // Show feedback briefly
  }

  return (
    <div className="flex gap-4 h-full">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}

      {/* User list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-bg-secondary rounded-lg px-3 py-2">
            <Search size={16} className="text-text-muted" />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setOffset(0) }}
              placeholder="Search by username or email..."
              className="flex-1 bg-transparent text-sm text-text-header outline-none placeholder-text-muted"
            />
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {loading && !users.length && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {users.map(u => (
            <div
              key={u.id}
              onClick={() => setSelected(u)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                selected?.id === u.id ? 'bg-brand/20' : 'hover:bg-bg-secondary'
              )}
            >
              <Avatar userId={u.id} username={u.username} avatarHash={u.avatar} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-text-header truncate">{u.username}</span>
                  {u.isStaff && <Crown size={12} className="text-warning flex-shrink-0" />}
                  {u.bot && <span className="text-[10px] bg-brand/30 text-brand px-1 rounded">BOT</span>}
                  {isBanned(u) && <span className="text-[10px] bg-danger/30 text-danger px-1 rounded">BANNED</span>}
                </div>
                <p className="text-xs text-text-muted truncate">{u.email}</p>
              </div>
              <p className="text-xs text-text-muted flex-shrink-0">
                {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/20">
          <p className="text-xs text-text-muted">{total.toLocaleString()} total users</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="p-1.5 rounded bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-muted">
              {Math.floor(offset / LIMIT) + 1} / {Math.max(1, Math.ceil(total / LIMIT))}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="p-1.5 rounded bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* User detail panel */}
      {selected && (
        <div className="w-72 bg-bg-secondary rounded-xl p-5 flex-shrink-0 overflow-y-auto">
          <div className="flex items-start justify-between mb-4">
            <Avatar userId={selected.id} username={selected.username} avatarHash={selected.avatar} size={48} />
            <button onClick={() => setSelected(null)} className="text-text-muted hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <h3 className="font-bold text-text-header text-lg">{selected.username}</h3>
          <p className="text-text-muted text-sm">{selected.email}</p>
          <p className="text-xs text-text-muted mt-1">ID: {selected.id}</p>
          <p className="text-xs text-text-muted">Joined: {new Date(selected.createdAt).toLocaleString()}</p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {selected.isStaff && <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">Staff</span>}
            {selected.verified && <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">Verified</span>}
            {isBanned(selected) && <span className="text-xs bg-danger/20 text-danger px-2 py-0.5 rounded-full">Banned</span>}
            {selected.bot && <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full">Bot</span>}
          </div>

          <div className="mt-5 space-y-2">
            <button
              onClick={() => toggleBan(selected)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isBanned(selected)
                  ? 'bg-success/20 text-success hover:bg-success/30'
                  : 'bg-danger/20 text-danger hover:bg-danger/30'
              )}
            >
              {isBanned(selected) ? <><Check size={16} /> Unban User</> : <><Ban size={16} /> Ban User</>}
            </button>
            <button
              onClick={() => toggleStaff(selected)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
            >
              <Crown size={16} />
              {selected.isStaff ? 'Remove Staff' : 'Grant Staff'}
            </button>
            <button
              onClick={() => kickSessions(selected)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-bg-primary text-text-muted hover:text-white transition-colors"
            >
              <LogOut size={16} />
              Force Logout
            </button>
            <button
              onClick={() => deleteUser(selected)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
            >
              <Trash2 size={16} />
              Delete Account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Guilds Panel ─────────────────────────────────────────────────────────────

function GuildsPanel() {
  const [guilds, setGuilds] = useState<AdminGuild[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<AdminGuild | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const LIMIT = 25

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<{ guilds: AdminGuild[]; total: number }>(
        `/api/v1/admin/guilds?q=${encodeURIComponent(q)}&limit=${LIMIT}&offset=${offset}`
      )
      setGuilds(r.guilds)
      setTotal(r.total)
    } catch {}
    setLoading(false)
  }, [q, offset])

  useEffect(() => { load() }, [load])

  const deleteGuild = (g: AdminGuild) => {
    setConfirm({
      message: `Permanently delete server "${g.name}"? This will delete all channels, messages, and members. This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null)
        await api.delete(`/api/v1/admin/guilds/${g.id}`)
        setSelected(null)
        load()
      },
    })
  }

  return (
    <div className="flex gap-4 h-full">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 bg-bg-secondary rounded-lg px-3 py-2">
            <Search size={16} className="text-text-muted" />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setOffset(0) }}
              placeholder="Search servers by name..."
              className="flex-1 bg-transparent text-sm text-text-header outline-none placeholder-text-muted"
            />
          </div>
          <button onClick={load} className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {guilds.map(g => (
            <div
              key={g.id}
              onClick={() => setSelected(g)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors',
                selected?.id === g.id ? 'bg-brand/20' : 'hover:bg-bg-secondary'
              )}
            >
              <div className="w-9 h-9 rounded-xl bg-bg-primary flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                {g.icon ? (
                  <img src={`/cdn/icons/${g.id}/${g.icon}`} alt={g.name} className="w-full h-full object-cover rounded-xl" />
                ) : g.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-header truncate">{g.name}</p>
                <p className="text-xs text-text-muted">{g.memberCount.toLocaleString()} members · by @{g.ownerUsername}</p>
              </div>
              <p className="text-xs text-text-muted flex-shrink-0">{new Date(g.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/20">
          <p className="text-xs text-text-muted">{total.toLocaleString()} total servers</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="p-1.5 rounded bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-text-muted">
              {Math.floor(offset / LIMIT) + 1} / {Math.max(1, Math.ceil(total / LIMIT))}
            </span>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="p-1.5 rounded bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="w-72 bg-bg-secondary rounded-xl p-5 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-bg-primary flex items-center justify-center text-white font-bold">
              {selected.name.slice(0, 2).toUpperCase()}
            </div>
            <button onClick={() => setSelected(null)} className="text-text-muted hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <h3 className="font-bold text-text-header text-lg">{selected.name}</h3>
          {selected.description && <p className="text-text-muted text-sm mt-1">{selected.description}</p>}
          <p className="text-xs text-text-muted mt-2">ID: {selected.id}</p>
          <p className="text-xs text-text-muted">Owner: @{selected.ownerUsername}</p>
          <p className="text-xs text-text-muted">Created: {new Date(selected.createdAt).toLocaleString()}</p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-bg-primary rounded-lg p-3 text-center">
              <p className="text-white font-bold text-lg">{selected.memberCount.toLocaleString()}</p>
              <p className="text-text-muted text-xs">Members</p>
            </div>
            <div className="bg-bg-primary rounded-lg p-3 text-center">
              <p className="text-white font-bold text-lg">{selected.channelCount.toLocaleString()}</p>
              <p className="text-text-muted text-xs">Channels</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => deleteGuild(selected)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
            >
              <Trash2 size={16} />
              Delete Server
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Audit Log Panel ──────────────────────────────────────────────────────────

function AuditLogPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get<AuditEntry[]>(`/api/v1/admin/audit-log?limit=${LIMIT}&offset=${offset}`)
      setEntries(Array.isArray(r) ? r : [])
    } catch {}
    setLoading(false)
  }, [offset])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-header font-semibold">Platform Audit Log</h3>
        <button onClick={load} className="p-2 rounded-lg bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {loading && !entries.length && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {entries.map(e => (
          <div key={e.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-secondary transition-colors">
            <div className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-bg-secondary text-brand px-1.5 py-0.5 rounded">{e.actionType}</span>
                {e.username && <span className="text-sm text-text-header">@{e.username}</span>}
                {e.targetId && <span className="text-xs text-text-muted">→ {e.targetId.slice(0, 12)}...</span>}
              </div>
              {e.reason && <p className="text-xs text-text-muted mt-0.5">{e.reason}</p>}
            </div>
            <p className="text-xs text-text-muted flex-shrink-0">{new Date(e.createdAt).toLocaleString()}</p>
          </div>
        ))}
        {entries.length === 0 && !loading && (
          <p className="text-center text-text-muted text-sm py-12">No audit log entries</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/20">
        <p className="text-xs text-text-muted">Showing {offset + 1}–{offset + entries.length}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
            className="p-1.5 rounded bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setOffset(offset + LIMIT)} disabled={entries.length < LIMIT}
            className="p-1.5 rounded bg-bg-secondary hover:bg-bg-primary text-text-muted hover:text-white transition-colors disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Overview Panel ───────────────────────────────────────────────────────────

function OverviewPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Stats>('/api/v1/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!stats) return <p className="text-danger text-sm">Failed to load stats.</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} sub={`+${stats.newUsersToday} today`} icon={Users} color="bg-brand" />
        <StatCard label="Online Users" value={stats.onlineUsers} icon={Activity} color="bg-status-online" />
        <StatCard label="Total Servers" value={stats.totalGuilds} sub={`+${stats.newGuildsToday} today`} icon={Server} color="bg-warning" />
        <StatCard label="Total Messages" value={stats.totalMessages} icon={MessageSquare} color="bg-purple-500" />
      </div>

      <div className="bg-bg-secondary rounded-xl p-5">
        <h3 className="text-text-header font-semibold mb-4 flex items-center gap-2">
          <BarChart3 size={18} />
          Platform Summary
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Users', value: stats.totalUsers },
            { label: 'Servers', value: stats.totalGuilds },
            { label: 'Messages', value: stats.totalMessages },
            { label: 'Channels', value: stats.totalChannels },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-white">{value.toLocaleString()}</div>
              <div className="text-xs text-text-muted mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-bg-secondary rounded-xl p-5">
        <h3 className="text-text-header font-semibold mb-2">Quick Actions</h3>
        <p className="text-text-muted text-sm">Use the sidebar to manage users, servers, and view audit logs.</p>
        <ul className="mt-3 space-y-1 text-sm text-text-muted list-disc list-inside">
          <li>Search and ban/unban users</li>
          <li>Grant or revoke staff privileges</li>
          <li>Force logout suspicious sessions</li>
          <li>Delete harmful servers</li>
          <li>View platform-wide audit trail</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

type AdminTab = 'overview' | 'users' | 'guilds' | 'audit-log'

const TABS: { id: AdminTab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'guilds', label: 'Servers', icon: Server },
  { id: 'audit-log', label: 'Audit Log', icon: Eye },
]

export default function AdminPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const [tab, setTab] = useState<AdminTab>('overview')

  // Redirect non-staff users
  if (user && !(user as any).isStaff) {
    navigate('/channels/@me')
    return null
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Top bar */}
      <div className="bg-bg-secondary border-b border-black/20 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-brand" />
            <span className="font-bold text-white text-lg">FreeCord Staff Portal</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Crown size={14} className="text-warning" />
            {user?.username}
          </div>
          <button
            onClick={() => navigate('/channels/@me')}
            className="flex items-center gap-1.5 text-sm text-text-muted hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
            Back to App
          </button>
        </div>
      </div>

      <div className="flex flex-1 max-w-7xl mx-auto w-full px-6 py-6 gap-6">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0">
          <nav className="space-y-0.5">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                  tab === t.id
                    ? 'bg-brand/20 text-white'
                    : 'text-text-muted hover:text-text-header hover:bg-bg-secondary'
                )}
              >
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="mt-6 p-3 bg-bg-secondary rounded-xl">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Staff</p>
            <div className="flex items-center gap-2">
              <Avatar userId={user?.id || ''} username={user?.username || ''} avatarHash={user?.avatar || null} size={28} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text-header truncate">{user?.username}</p>
                <p className="text-[10px] text-warning">Staff</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-white">
              {TABS.find(t => t.id === tab)?.label}
            </h1>
          </div>
          <div className="h-[calc(100vh-200px)] flex flex-col">
            {tab === 'overview' && <OverviewPanel />}
            {tab === 'users' && <UsersPanel />}
            {tab === 'guilds' && <GuildsPanel />}
            {tab === 'audit-log' && <AuditLogPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
