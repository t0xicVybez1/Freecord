import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { Button } from '@/components/ui/Button'
import { CDNUtils } from '@/lib/cdn'
import { cn, stringToColor, getInitials } from '@/lib/utils'
import api from '@/lib/api'
import type { Guild, GuildInvite } from '@freecord/types'

export default function InvitePage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuthStore()
  const { addGuild } = useGuildsStore()
  const { setGuildChannels } = useChannelsStore()
  const [invite, setInvite] = useState<GuildInvite | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    api.get<GuildInvite>(`/api/v1/invites/${code}`)
      .then(setInvite)
      .catch(() => setError('This invite is invalid or has expired.'))
      .finally(() => setLoading(false))
  }, [code])

  // Redirect to login if not authenticated, preserving invite URL
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/login?redirect=/invite/${code}`)
    }
  }, [authLoading, isAuthenticated, code, navigate])

  const handleJoin = async () => {
    if (!code || !invite) return
    setJoining(true)
    setError('')
    try {
      const guild = await api.post<Guild>(`/api/v1/invites/${code}`, {})
      addGuild(guild)
      if (guild.channels) setGuildChannels(guild.id, guild.channels)
      const firstText = guild.channels?.find(c => c.type === 0 /* GUILD_TEXT */)
      navigate(firstText ? `/channels/${guild.id}/${firstText.id}` : `/channels/${guild.id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to join server.')
      setJoining(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="bg-bg-secondary rounded-xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
          <div className="text-5xl mb-4">😕</div>
          <h2 className="text-xl font-bold text-text-header mb-2">Invite Invalid</h2>
          <p className="text-text-muted text-sm mb-6">{error}</p>
          <Button onClick={() => navigate('/channels/@me')} className="w-full">Go Home</Button>
        </div>
      </div>
    )
  }

  const guild = invite?.guild

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="bg-bg-secondary rounded-xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
        {/* Guild banner */}
        {guild?.banner && (
          <div className="h-24 rounded-t-lg overflow-hidden -mx-8 -mt-8 mb-0">
            <img src={CDNUtils.guildBanner(guild.id, guild.banner)} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Guild icon */}
        <div className="flex justify-center mb-4 mt-2">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold shadow-lg"
            style={{ backgroundColor: guild?.icon ? undefined : stringToColor(guild?.name || '') }}
          >
            {guild?.icon
              ? <img src={CDNUtils.guildIcon(guild.id, guild.icon)} alt={guild.name} className="w-full h-full object-cover" />
              : getInitials(guild?.name || '?')
            }
          </div>
        </div>

        {/* Invite info */}
        <p className="text-text-muted text-sm mb-1">
          {invite?.inviter
            ? <><span className="text-text-header font-medium">{invite.inviter.username}</span> invited you to join</>
            : 'You have been invited to join'
          }
        </p>
        <h2 className="text-2xl font-bold text-text-header mb-1">{guild?.name}</h2>
        <div className="flex items-center justify-center gap-4 text-sm text-text-muted mb-6">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-online inline-block" />
            {guild?.approximateMemberCount?.toLocaleString() ?? '–'} Online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-text-muted inline-block" />
            {guild?.memberCount?.toLocaleString() ?? '–'} Members
          </span>
        </div>

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <Button onClick={handleJoin} loading={joining} className="w-full mb-2">
          Accept Invite
        </Button>
        <button onClick={() => navigate('/channels/@me')} className="text-text-muted text-sm hover:text-text-header transition-colors">
          No thanks
        </button>
      </div>
    </div>
  )
}
