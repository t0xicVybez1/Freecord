import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'

const TENOR_KEY = import.meta.env.VITE_TENOR_API_KEY

interface GifResult {
  id: string
  url: string
  preview: string
  title: string
}

interface GifPickerProps {
  onSelect: (url: string) => void
  onClose: () => void
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [loading, setLoading] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => { searchRef.current?.focus() }, [])

  const fetchGifs = useCallback(async (q: string) => {
    if (!TENOR_KEY) return
    setLoading(true)
    try {
      const endpoint = q.trim()
        ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=20&media_filter=gif`
        : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=20&media_filter=gif`
      const res = await fetch(endpoint)
      if (!res.ok) return
      const data = await res.json()
      setGifs((data.results || []).map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url || '',
        preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
        title: r.content_description || r.title || '',
      })))
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchGifs(search), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, fetchGifs])

  useEffect(() => { fetchGifs('') }, [fetchGifs])

  if (!TENOR_KEY) {
    return (
      <div
        ref={pickerRef}
        className="w-72 bg-bg-floating border border-black/30 rounded-xl shadow-2xl flex flex-col items-center justify-center gap-3 p-6 text-center z-50"
      >
        <div className="text-4xl">🎬</div>
        <p className="text-text-header text-sm font-semibold">GIF Picker</p>
        <p className="text-text-muted text-xs leading-relaxed">
          To enable GIFs, add your Tenor API key to your environment:
        </p>
        <code className="text-xs bg-black/30 text-text-header px-2 py-1 rounded w-full text-center break-all">
          VITE_TENOR_API_KEY=your_key_here
        </code>
        <p className="text-text-muted text-xs">
          Get a free key at{' '}
          <span className="text-brand">tenor.com/developer/keyregistration</span>
        </p>
        <button
          onClick={onClose}
          className="mt-1 text-xs text-text-muted hover:text-text-header transition-colors"
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div
      ref={pickerRef}
      className="w-80 h-96 bg-bg-floating border border-black/30 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50"
    >
      {/* Search */}
      <div className="p-2 border-b border-white/5">
        <div className="flex items-center gap-2 bg-bg-input rounded-lg px-2 py-1.5">
          <Search size={14} className="text-text-muted flex-shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="flex-1 bg-transparent text-sm text-text-header placeholder-text-muted outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-text-muted hover:text-text-header">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* GIF grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && gifs.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {search ? 'No GIFs found' : 'No trending GIFs'}
          </div>
        )}
        {!loading && gifs.length > 0 && (
          <div className="columns-2 gap-2">
            {gifs.map(gif => (
              <button
                key={gif.id}
                onClick={() => { onSelect(gif.url); onClose() }}
                className="w-full mb-2 rounded overflow-hidden hover:opacity-80 transition-opacity block"
                title={gif.title}
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-auto object-cover rounded"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 border-t border-white/5 text-center">
        <span className="text-text-muted text-[10px]">Powered by Tenor</span>
      </div>
    </div>
  )
}
