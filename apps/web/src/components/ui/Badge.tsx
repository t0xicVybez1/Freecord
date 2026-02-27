import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'danger' | 'success' | 'warning'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center rounded-full text-xs font-bold min-w-[18px] h-[18px] px-1',
      {
        'bg-danger text-white': variant === 'danger',
        'bg-success text-white': variant === 'success',
        'bg-status-idle text-black': variant === 'warning',
        'bg-brand text-white': variant === 'default',
      },
      className
    )}>
      {children}
    </span>
  )
}
