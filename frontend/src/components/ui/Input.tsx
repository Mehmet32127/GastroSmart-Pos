import React from 'react'
import { cn } from '@/utils/format'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  onIconRightClick?: () => void
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, onIconRightClick, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-text-muted)] font-body">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3 text-[var(--color-text-muted)] pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full bg-[var(--color-surface2)] border border-[var(--color-border)]',
              'text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50',
              'rounded-xl px-3.5 py-2.5 text-sm font-body',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50',
              'transition-all duration-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              icon ? 'pl-10' : '',
              iconRight ? 'pr-10' : '',
              error ? 'border-red-500/50 focus:ring-red-500/20' : '',
              className
            )}
            {...props}
          />
          {iconRight && (
            <button
              type="button"
              onClick={onIconRightClick}
              className="absolute right-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              {iconRight}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400 font-body">{error}</p>}
        {hint && !error && <p className="text-xs text-[var(--color-text-muted)] font-body">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">{label}</label>
      )}
      <textarea
        ref={ref}
        rows={3}
        className={cn(
          'w-full bg-[var(--color-surface2)] border border-[var(--color-border)]',
          'text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50',
          'rounded-xl px-3.5 py-2.5 text-sm font-body resize-none',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50',
          'transition-all duration-200',
          error ? 'border-red-500/50' : '',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string | number; label: string }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[var(--color-text-muted)] font-body">{label}</label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full bg-[var(--color-surface2)] border border-[var(--color-border)]',
          'text-[var(--color-text)]',
          'rounded-xl px-3.5 py-2.5 text-sm font-body',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]/50',
          'transition-all duration-200',
          error ? 'border-red-500/50' : '',
          className
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'
