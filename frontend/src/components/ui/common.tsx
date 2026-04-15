import React from 'react'
import { cn } from '@/utils/format'

// ─── Badge ───────────────────────────────────────────────────────────────────
type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/20',
  success: 'bg-green-500/15 text-green-400 border-green-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/15 text-red-400 border-red-500/20',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  muted: 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] border-[var(--color-border)]',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className, dot }) => (
  <span className={cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border font-body',
    badgeVariants[variant],
    className
  )}>
    {dot && (
      <span className={cn(
        'w-1.5 h-1.5 rounded-full flex-shrink-0',
        variant === 'success' && 'bg-green-400',
        variant === 'warning' && 'bg-amber-400',
        variant === 'danger' && 'bg-red-400',
        variant === 'info' && 'bg-blue-400',
        variant === 'default' && 'bg-[var(--color-accent)]',
        variant === 'muted' && 'bg-[var(--color-text-muted)]',
      )} />
    )}
    {children}
  </span>
)

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' }

export const Card: React.FC<CardProps> = ({ children, className, hover, onClick, padding = 'md' }) => (
  <div
    onClick={onClick}
    className={cn(
      'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-card',
      'shadow-inner-glow',
      hover && 'transition-all duration-200 hover:shadow-card-hover hover:border-[var(--color-accent)]/20 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      paddingClasses[padding],
      className
    )}
  >
    {children}
  </div>
)

// ─── Spinner ─────────────────────────────────────────────────────────────────
interface SpinnerProps { size?: number; className?: string }

export const Spinner: React.FC<SpinnerProps> = ({ size = 20, className }) => (
  <svg
    className={cn('animate-spin text-[var(--color-accent)]', className)}
    style={{ width: size, height: size }}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

// ─── Empty State ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    {icon && (
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface2)] flex items-center justify-center mb-4 text-[var(--color-text-muted)]">
        {icon}
      </div>
    )}
    <h3 className="text-base font-semibold text-[var(--color-text)] font-display mb-1">{title}</h3>
    {description && (
      <p className="text-sm text-[var(--color-text-muted)] font-body max-w-sm mb-4">{description}</p>
    )}
    {action}
  </div>
)

// ─── Divider ─────────────────────────────────────────────────────────────────
export const Divider: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <div className={cn('flex items-center gap-3', className)}>
    <div className="flex-1 h-px bg-[var(--color-border)]" />
    {label && <span className="text-xs text-[var(--color-text-muted)] font-body whitespace-nowrap">{label}</span>}
    {label && <div className="flex-1 h-px bg-[var(--color-border)]" />}
  </div>
)
