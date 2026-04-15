import React, { useRef } from 'react'
import { cn } from '@/utils/format'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:brightness-110 shadow-glow-brand',
  secondary: 'bg-[var(--color-surface2)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface2)]/80',
  danger: 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30',
  ghost: 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]',
  success: 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30',
}

const sizeClasses: Record<Size, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-lg gap-1',
  sm: 'px-3 py-1.5 text-sm rounded-xl gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-base rounded-2xl gap-2',
  xl: 'px-6 py-3 text-base rounded-2xl gap-2.5',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, className, children, onClick, disabled, ...props }, ref) => {
    const rippleRef = useRef<HTMLSpanElement | null>(null)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Ripple effect
      const btn = e.currentTarget
      const rect = btn.getBoundingClientRect()
      const ripple = document.createElement('span')
      const diameter = Math.max(rect.width, rect.height)
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.15);
        width: ${diameter}px;
        height: ${diameter}px;
        left: ${e.clientX - rect.left - diameter / 2}px;
        top: ${e.clientY - rect.top - diameter / 2}px;
        pointer-events: none;
        animation: ripple 0.6s linear;
      `
      btn.appendChild(ripple)
      setTimeout(() => ripple.remove(), 600)
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center font-body font-medium',
          'transition-all duration-200 active:scale-95 overflow-hidden',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        onClick={handleClick}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children && <span>{children}</span>}
        {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
