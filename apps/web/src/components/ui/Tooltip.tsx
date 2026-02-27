import { ReactNode, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: ReactNode
  content: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function Tooltip({ children, content, side = 'top', delay = 500 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()

  const show = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const g = 8
    let x = rect.left + rect.width / 2, y = rect.top - g
    if (side === 'bottom') y = rect.bottom + g
    if (side === 'left') { x = rect.left - g; y = rect.top + rect.height / 2 }
    if (side === 'right') { x = rect.right + g; y = rect.top + rect.height / 2 }
    setPos({ x, y })
    timer.current = window.setTimeout(() => setVisible(true), delay)
  }

  const hide = () => { clearTimeout(timer.current); setVisible(false) }

  const transform = side === 'top' ? 'translate(-50%,-100%)' : side === 'bottom' ? 'translate(-50%,0)' : side === 'left' ? 'translate(-100%,-50%)' : 'translate(0,-50%)'

  return (
    <>
      <div ref={ref} onMouseEnter={show} onMouseLeave={hide}>{children}</div>
      {visible && createPortal(
        <div className="fixed z-[9999] bg-bg-floating text-text-normal text-xs font-medium px-2 py-1.5 rounded pointer-events-none shadow-lg whitespace-nowrap animate-fade-in"
          style={{ left: pos.x, top: pos.y, transform }}>
          {content}
        </div>,
        document.body
      )}
    </>
  )
}
