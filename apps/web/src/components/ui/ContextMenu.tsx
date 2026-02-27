import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useUIStore } from '@/stores/ui'
import { cn } from '@/lib/utils'

export function ContextMenu() {
  const { contextMenu, closeContextMenu } = useUIStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu()
    }
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', keyHandler) }
  }, [contextMenu, closeContextMenu])

  if (!contextMenu) return null

  const { x, y, items } = contextMenu
  const menuW = 188, menuH = items.length * 32 + 16
  const left = Math.min(x, window.innerWidth - menuW - 8)
  const top = Math.min(y, window.innerHeight - menuH - 8)

  return createPortal(
    <div ref={ref} className="fixed z-[9999] bg-bg-floating rounded-md shadow-xl py-1.5 min-w-[188px] animate-scale-in"
      style={{ left, top }}>
      {items.map((item, i) => (
        item.divider
          ? <div key={i} className="my-1 border-t border-white/[0.08]" />
          : <button
              key={i}
              disabled={item.disabled}
              onClick={() => { item.onClick(); closeContextMenu() }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 rounded mx-1 transition-colors disabled:opacity-50',
                item.danger ? 'text-danger hover:bg-danger hover:text-white' : 'text-text-normal hover:bg-brand hover:text-white',
                'w-[calc(100%-8px)]'
              )}
            >
              {item.icon && <span className="w-4 h-4 flex-shrink-0">{item.icon}</span>}
              {item.label}
            </button>
      ))}
    </div>,
    document.body
  )
}
