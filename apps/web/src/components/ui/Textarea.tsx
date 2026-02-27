import { forwardRef, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'bg-bg-input text-text-normal placeholder-interactive-muted rounded px-3 py-2 text-sm border-2 outline-none transition-colors resize-none w-full',
          error ? 'border-danger' : 'border-transparent focus:border-brand',
          className
        )}
        {...props}
      />
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'
