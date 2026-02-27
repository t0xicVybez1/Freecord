import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, Clock, Smile, Trees, Coffee, Gamepad2, Car, Lightbulb, Hash, Flag } from 'lucide-react'
import { useGuildsStore } from '@/stores/guilds'
import { CDNUtils } from '@/lib/cdn'

const RECENT_KEY = 'freecord_recent_emoji'

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function addRecent(emoji: string) {
  const list = [emoji, ...getRecent().filter(e => e !== emoji)].slice(0, 24)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

// --- Unicode emoji data by category ---
const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: 'Smileys & People',
    icon: '😀',
    emoji: [
      '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗',
      '😙','🥲','😚','☺️','🙂','🤗','🤩','🤔','🫡','🤨','😐','😑','😶','🫥','😏','😒',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶',
      '🥴','😵','🫠','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮',
      '😯','😲','😳','🥺','🫣','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞',
      '😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺',
      '👻','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾',
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟',
      '🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏',
      '🙌','🫶','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃',
      '🫀','🫁','🧠','🦷','🦴','👁️','👀','👅','👄','🫦','👶','🧒','👦','👧','🧑','👱',
      '👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷',
    ],
  },
  {
    id: 'animals',
    label: 'Animals & Nature',
    icon: '🐶',
    emoji: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵',
      '🙈','🙉','🙊','🐒','🦆','🐦','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛',
      '🦋','🐌','🐞','🐜','🪲','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑',
      '🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧',
      '🦣','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑',
      '🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🕊️',
      '🌸','🌺','🌻','🌹','🌷','🌼','💐','🍀','🌿','☘️','🍃','🍂','🍁','🌾','🌵','🌴',
      '🌲','🌳','🌱','🌍','🌎','🌏','🌑','🌒','🌓','🌔','🌕','🌙','⭐','🌟','💫','✨',
      '⚡','🌈','☁️','⛅','🌤️','🌥️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨',
    ],
  },
  {
    id: 'food',
    label: 'Food & Drink',
    icon: '🍕',
    emoji: [
      '🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍑','🥭','🍍','🥥','🥝','🍅','🫒',
      '🥑','🍆','🥔','🥕','🌽','🌶️','🥒','🥬','🥦','🧄','🧅','🍄','🥜','🫘','🌰','🍞',
      '🥐','🥖','🥨','🥯','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭',
      '🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🍝','🍜','🍲',
      '🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮',
      '🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','🍵','☕','🫖','🍶',
      '🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧉','🍾','🧊','🥄','🍴','🍽️','🥢','🫙',
    ],
  },
  {
    id: 'activities',
    label: 'Activities',
    icon: '⚽',
    emoji: [
      '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🏒','🏑','🥍','🏏',
      '🪃','🥅','⛳','🪁','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪀','🪆','🎖️','🏆','🥇',
      '🥈','🥉','🏅','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹',
      '🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗','🎲','♟️','🎮','🕹️','🎰','🧩','🪅','🎭',
      '🎠','🎡','🎢','🎪','🎯','🏹','🎳','🎑','🎆','🎇','🧨','✨','🎉','🎊','🎈','🎁',
      '🎀','🎋','🎍','🎎','🎏','🎐','🧧','🎑','🎄','🎃','🎆','🎇','🧸','🪆','🪅','🪩',
    ],
  },
  {
    id: 'travel',
    label: 'Travel & Places',
    icon: '✈️',
    emoji: [
      '🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍️','🛵',
      '🚲','🛴','🛹','🛼','🚁','🛸','🚀','✈️','🛩️','🛫','🛬','🚂','🚃','🚄','🚅','🚆',
      '🚇','🚈','🚉','🚊','🚞','🚋','🚝','🚠','🚡','🚟','⛵','🚤','🛥️','🛳️','⛴️','🚢',
      '⚓','🛟','⛽','🚧','🚦','🚥','🛑','🚨','🏁','🚩','🎌','🏳️','🏴',
      '🗺️','🌐','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️',
      '🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰',
      '💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅',
      '🌆','🌇','🌉','♨️','🎠','🎡','🎢','💈','🎪',
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: '💡',
    emoji: [
      '⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','🧮','📷','📸',
      '📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🧭','⏱️','⏲️','⏰','🕰️','⌛',
      '⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷',
      '🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🔩','🪤','🧲',
      '🔫','💣','🪝','🔪','🗡️','⚔️','🛡️','🪚','🔑','🗝️','🔐','🔏','🔒','🔓','🚪','🪞',
      '🪟','🛋️','🪑','🚽','🪠','🚿','🛁','🪤','🧹','🧺','🧻','🪣','🧼','🫧','🪥','🧽',
      '🧴','🛒','🚬','⚰️','🪦','⚱️','🏺','🔮','🪄','💈','⚗️','🔭','🔬','🩺','🩻','🩹',
      '🩼','🩸','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧲','🪜','🧲',
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: '❤️',
    emoji: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓',
      '💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐',
      '⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑',
      '☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴',
      '🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯',
      '💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🔕','🔇','🔈','🔉','🔊','📣','📢','💬',
      '💭','🗯️','♻️','⚜️','🔱','📛','🔰','⭕','✅','☑️','✔️','❎','🔲','🔳','⬛','⬜',
      '◼️','◻️','◾','◽','▪️','▫️','🟥','🟧','🟨','🟩','🟦','🟪','⚫','⚪','🟫','🔶',
      '🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','➕','➖','➗','✖️','♾️','💲','💱',
      '™️','©️','®️','🔅','🔆','🔱','⚜️','🔰','⭕','🚩','🎌','🏳️','🏴','🚀','💥','❗',
    ],
  },
  {
    id: 'flags',
    label: 'Flags',
    icon: '🏳️',
    emoji: [
      '🏳️','🏴','🏁','🚩','🎌','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️',
      '🇦🇫','🇦🇱','🇩🇿','🇦🇩','🇦🇴','🇦🇷','🇦🇲','🇦🇺','🇦🇹','🇦🇿',
      '🇧🇸','🇧🇭','🇧🇩','🇧🇧','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇴','🇧🇦',
      '🇧🇷','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇨🇫',
      '🇹🇩','🇨🇱','🇨🇳','🇨🇴','🇰🇲','🇨🇬','🇨🇷','🇭🇷','🇨🇺','🇨🇾',
      '🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪',
      '🇸🇿','🇪🇹','🇫🇯','🇫🇮','🇫🇷','🇬🇦','🇬🇲','🇬🇪','🇩🇪','🇬🇭',
      '🇬🇷','🇬🇩','🇬🇹','🇬🇳','🇬🇼','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸',
      '🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇱','🇮🇹','🇯🇲','🇯🇵','🇯🇴',
      '🇰🇿','🇰🇪','🇰🇮','🇽🇰','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸',
      '🇱🇷','🇱🇾','🇱🇮','🇱🇹','🇱🇺','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱',
      '🇲🇹','🇲🇭','🇲🇷','🇲🇺','🇲🇽','🇫🇲','🇲🇩','🇲🇨','🇲🇳','🇲🇪',
      '🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇷','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪',
      '🇳🇬','🇳🇴','🇴🇲','🇵🇰','🇵🇼','🇵🇸','🇵🇦','🇵🇬','🇵🇾','🇵🇪',
      '🇵🇭','🇵🇱','🇵🇹','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇼🇸','🇸🇲','🇸🇹',
      '🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇬','🇸🇰','🇸🇮','🇸🇧','🇸🇴','🇿🇦',
      '🇸🇸','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇪','🇨🇭','🇸🇾','🇹🇼','🇹🇯',
      '🇹🇿','🇹🇭','🇹🇱','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇺🇬',
      '🇺🇦','🇦🇪','🇬🇧','🇺🇸','🇺🇾','🇺🇿','🇻🇺','🇻🇪','🇻🇳','🇾🇪',
      '🇿🇲','🇿🇼',
    ],
  },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  recent: <Clock size={16} />,
  smileys: <Smile size={16} />,
  animals: <Trees size={16} />,
  food: <Coffee size={16} />,
  activities: <Gamepad2 size={16} />,
  travel: <Car size={16} />,
  objects: <Lightbulb size={16} />,
  symbols: <Hash size={16} />,
  flags: <Flag size={16} />,
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  guildId?: string
  onClose?: () => void
}

export function EmojiPicker({ onSelect, guildId, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('recent')
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const guild = useGuildsStore(s => guildId ? s.guilds[guildId] : undefined)
  const guildEmoji = guild?.emojis || []

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Focus search on open
  useEffect(() => { searchRef.current?.focus() }, [])

  const recent = getRecent()

  const allCategories = useMemo(() => {
    const cats = []
    if (recent.length > 0) cats.push({ id: 'recent', label: 'Recently Used', icon: '🕐', emoji: recent })
    if (guildEmoji.length > 0) cats.push({ id: 'guild', label: guild?.name || 'Server Emoji', icon: '🖼️', emoji: [] })
    return [...cats, ...EMOJI_CATEGORIES]
  }, [recent.length, guildEmoji.length, guild?.name])

  const handleSelect = (emoji: string) => {
    addRecent(emoji)
    onSelect(emoji)
  }

  const filteredEmoji = useMemo(() => {
    if (!search.trim()) return null
    const q = search.toLowerCase()
    const results: string[] = []
    for (const cat of EMOJI_CATEGORIES) {
      for (const e of cat.emoji) {
        if (results.length >= 60) break
        // Simple inclusion: unicode emoji contain the chars, so just add all
        results.push(e)
      }
    }
    // For actual search we'd need emoji names; return all for now when search active
    return results.slice(0, 60)
  }, [search])

  const displayCategory = allCategories.find(c => c.id === activeCategory)

  const renderEmoji = (emoji: string) => (
    <button
      key={emoji}
      onClick={() => handleSelect(emoji)}
      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded text-xl transition-colors"
      title={emoji}
    >
      {emoji}
    </button>
  )

  return (
    <div
      ref={pickerRef}
      className="w-72 h-80 bg-bg-floating border border-black/30 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50"
    >
      {/* Search */}
      <div className="p-2 border-b border-white/5">
        <div className="flex items-center gap-2 bg-bg-input rounded-lg px-2 py-1.5">
          <Search size={14} className="text-text-muted flex-shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="flex-1 bg-transparent text-sm text-text-header placeholder-text-muted outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-white/5 overflow-x-auto">
        {allCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded text-sm transition-colors ${
              activeCategory === cat.id ? 'bg-brand/20 text-brand' : 'text-text-muted hover:text-text-header hover:bg-white/5'
            }`}
            title={cat.label}
          >
            {CATEGORY_ICONS[cat.id] || <span className="text-base">{cat.icon}</span>}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredEmoji ? (
          <>
            <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">Search results</p>
            <div className="flex flex-wrap">
              {filteredEmoji.map(renderEmoji)}
            </div>
          </>
        ) : activeCategory === 'guild' ? (
          <>
            <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">{guild?.name}</p>
            <div className="flex flex-wrap">
              {guildEmoji.map((e: any) => (
                <button
                  key={e.id}
                  onClick={() => handleSelect(e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                  title={e.name}
                >
                  <img src={CDNUtils.emoji(e.id, e.animated)} alt={e.name} className="w-6 h-6 object-contain" />
                </button>
              ))}
              {guildEmoji.length === 0 && (
                <p className="text-text-muted text-xs py-4 w-full text-center">No custom emoji</p>
              )}
            </div>
          </>
        ) : displayCategory ? (
          <>
            <p className="text-xs text-text-muted mb-1.5 font-semibold uppercase tracking-wide">{displayCategory.label}</p>
            <div className="flex flex-wrap">
              {displayCategory.emoji.map(renderEmoji)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
