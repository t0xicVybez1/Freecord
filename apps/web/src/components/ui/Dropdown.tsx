import { ReactNode, useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownItem {
  label: string
  value: string
  icon?: ReactNode
  danger?: boolean
}

interface DropdownProps {
  value?: string
  placeholder?: string
  items: DropdownItem[]
  onChange: (value: string) => void
  className?: string
}

export function Dropdown({ value, placeholder = 'Select...', items, onChange, className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = items.find(i => i.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full bg-bg-input text-sm text-text-normal px-3 py-2 rounded flex items-center justify-between hover:bg-bg-floating transition-colors"
      >
        <span className={selected ? 'text-text-normal' : 'text-interactive-muted'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={16} className={cn('text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-floating rounded-md shadow-xl z-50 overflow-hidden animate-scale-in">
          {items.map(item => (
            <button
              key={item.value}
              onClick={() => { onChange(item.value); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/[0.06] transition-colors',
                item.value === value ? 'text-brand' : item.danger ? 'text-danger' : 'text-text-normal'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
