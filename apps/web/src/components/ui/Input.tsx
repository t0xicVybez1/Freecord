import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {label}{props.required && <span className="text-danger ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'bg-bg-input text-text-normal placeholder-interactive-muted rounded px-3 py-2 text-sm border-2 outline-none transition-colors w-full',
            error ? 'border-danger' : 'border-transparent focus:border-brand',
            className
          )}
          {...props}
        />
        {error && <p className="text-danger text-xs">{error}</p>}
        {helperText && !error && <p className="text-text-muted text-xs">{helperText}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
