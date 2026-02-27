import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, Compass } from 'lucide-react'
import { api } from '@/lib/api'
import { CDNUtils } from '@/lib/cdn'
import { stringToColor, getInitials } from '@/lib/utils'
import { useGuildsStore } from '@/stores/guilds'
import { useChannelsStore } from '@/stores/channels'
import { ChannelType } from '@freecord/types'

interface PublicGuild {
  id: string
  name: string
  icon: string | null
  banner: string | null
  description: string | null
  approximateMemberCount: number
  features: string[]
  vanityUrlCode: string | null
}

function formatMemberCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export default function ExplorePage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [guilds, setGuilds] = useState<PublicGuild[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const myGuilds = useGuildsStore(s => s.guilds)
  const channels = useChannelsStore(s => s.channels)

  const fetchGuilds = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await api.get<{ guilds: PublicGuild[]; total: number }>(
        `/api/v1/guilds/public?q=${encodeURIComponent(q)}&limit=48`
      )
      setGuilds(res.guilds)
      setTotal(res.total)
    } catch {
      setGuilds([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchGuilds(query), query ? 300 : 0)
    return () => clearTimeout(timer)
  }, [query, fetchGuilds])

  const handleJoin = async (guild: PublicGuild) => {
    if (myGuilds[guild.id]) {
      // Already a member — navigate to it
      const guildChannels = Object.values(channels).filter(
        c => c.guildId === guild.id && c.type === ChannelType.GUILD_TEXT
      )
      const first = guildChannels[0]
      navigate(first ? `/channels/${guild.id}/${first.id}` : `/channels/${guild.id}`)
      return
    }

    setJoiningId(guild.id)
    try {
      if (guild.vanityUrlCode) {
        await api.post(`/api/v1/invites/${guild.vanityUrlCode}`, {})
      } else {
        // Try the guild ID as a direct join (public guild)
        await api.post(`/api/v1/guilds/${guild.id}/join`, {})
      }
      // Navigate after a short delay for store to update
      setTimeout(() => {
        navigate(`/channels/${guild.id}`)
      }, 500)
    } catch {
      // ignore
    } finally {
      setJoiningId(null)
    }
  }

  const isMember = (guildId: string) => !!myGuilds[guildId]

  return (
    <div className="flex-1 bg-bg-primary overflow-y-auto">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-brand/20 to-transparent px-8 pt-12 pb-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Compass size={40} className="text-brand" />
            <h1 className="text-4xl font-bold text-white">Explore Servers</h1>
          </div>
          <p className="text-text-muted text-lg mb-6">
            Find your community. Browse public servers across every topic imaginable.
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search communities..."
              className="w-full bg-bg-secondary border border-black/20 rounded-lg pl-11 pr-4 py-3 text-white placeholder-text-muted focus:outline-none focus:border-brand text-base"
            />
          </div>
          {!loading && (
            <p className="text-text-muted text-sm mt-3">
              {total === 0 ? 'No public servers found.' : `${total.toLocaleString()} public server${total !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>
      </div>

      {/* Server grid */}
      <div className="max-w-6xl mx-auto px-8 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : guilds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-text-muted gap-4">
            <Compass size={64} className="opacity-30" />
            <p className="text-xl font-medium">No servers found</p>
            {query && <p className="text-sm">Try a different search term</p>}
            {!query && <p className="text-sm">No public servers available yet.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {guilds.map(guild => (
              <div
                key={guild.id}
                className="bg-bg-secondary rounded-xl overflow-hidden hover:bg-bg-tertiary transition-colors cursor-pointer group flex flex-col"
                onClick={() => handleJoin(guild)}
              >
                {/* Banner */}
                <div className="h-24 bg-gradient-to-br from-bg-tertiary to-bg-floating relative overflow-hidden flex-shrink-0">
                  {guild.banner ? (
                    <img
                      src={CDNUtils.guildBanner(guild.id, guild.banner)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full opacity-30"
                      style={{ backgroundColor: stringToColor(guild.name) }}
                    />
                  )}
                </div>

                {/* Icon + info */}
                <div className="px-4 pb-4 flex-1 flex flex-col">
                  {/* Avatar overlapping banner */}
                  <div className="-mt-8 mb-3">
                    <div
                      className="w-14 h-14 rounded-full border-4 border-bg-secondary overflow-hidden flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ backgroundColor: guild.icon ? undefined : stringToColor(guild.name) }}
                    >
                      {guild.icon
                        ? <img src={CDNUtils.guildIcon(guild.id, guild.icon)} alt={guild.name} className="w-full h-full object-cover" />
                        : getInitials(guild.name)
                      }
                    </div>
                  </div>

                  <h3 className="font-semibold text-white text-sm leading-tight mb-1 line-clamp-1">{guild.name}</h3>

                  {guild.description && (
                    <p className="text-text-muted text-xs leading-relaxed mb-2 line-clamp-2 flex-1">{guild.description}</p>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-2">
                    <div className="flex items-center gap-1 text-text-muted text-xs">
                      <Users size={12} />
                      <span>{formatMemberCount(guild.approximateMemberCount)} members</span>
                    </div>

                    <button
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                        isMember(guild.id)
                          ? 'bg-bg-floating text-text-muted hover:bg-white/10'
                          : 'bg-brand text-white hover:bg-brand/80'
                      } ${joiningId === guild.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={e => { e.stopPropagation(); handleJoin(guild) }}
                      disabled={joiningId === guild.id}
                    >
                      {joiningId === guild.id ? '...' : isMember(guild.id) ? 'Visit' : 'Join'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
