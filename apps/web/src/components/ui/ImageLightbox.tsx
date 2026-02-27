import { useEffect, useCallback } from 'react'
import { X, Download, ExternalLink, ZoomIn } from 'lucide-react'

interface ImageLightboxProps {
  src: string
  alt?: string
  filename?: string
  onClose: () => void
}

export function ImageLightbox({ src, alt, filename, onClose }: ImageLightboxProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 animate-fade-in"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={e => e.stopPropagation()}>
        {filename && (
          <span className="text-white/70 text-sm">{filename}</span>
        )}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-colors"
          title="Open original"
        >
          <ExternalLink size={16} />
        </a>
        <a
          href={src}
          download={filename}
          className="w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-colors"
          title="Download"
          onClick={e => e.stopPropagation()}
        >
          <Download size={16} />
        </a>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Image */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center" onClick={e => e.stopPropagation()}>
        <img
          src={src}
          alt={alt || filename || 'Image'}
          className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl select-none"
          draggable={false}
        />
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs">
        Click outside or press Esc to close
      </div>
    </div>
  )
}
