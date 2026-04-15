import React, { useState } from 'react'
import { Users, Clock, Receipt } from 'lucide-react'
import { cn, formatCurrency, formatRelative } from '@/utils/format'
import type { Table } from '@/types'

const STATUS_CONFIG = {
  available: {
    label: 'Boş',
    bg: 'bg-status-available-dim',
    border: 'border-status-available/30',
    text: 'text-status-available',
    dot: 'bg-status-available',
    glow: 'hover:shadow-glow-green',
  },
  occupied: {
    label: 'Dolu',
    bg: 'bg-status-occupied-dim',
    border: 'border-status-occupied/30',
    text: 'text-status-occupied',
    dot: 'bg-status-occupied',
    glow: 'hover:shadow-glow-red',
  },
  reserved: {
    label: 'Rezerve',
    bg: 'bg-status-reserved-dim',
    border: 'border-status-reserved/30',
    text: 'text-status-reserved',
    dot: 'bg-status-reserved',
    glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]',
  },
  cleaning: {
    label: 'Temizleniyor',
    bg: 'bg-status-cleaning-dim',
    border: 'border-status-cleaning/30',
    text: 'text-status-cleaning',
    dot: 'bg-status-cleaning',
    glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]',
  },
}

interface TableCardProps {
  table: Table
  onClick: (table: Table) => void
  isSelected?: boolean
}

export const TableCard: React.FC<TableCardProps> = ({ table, onClick, isSelected }) => {
  const [pressed, setPressed] = useState(false)
  const cfg = STATUS_CONFIG[table.status]

  const handleClick = () => {
    setPressed(true)
    setTimeout(() => setPressed(false), 200)
    onClick(table)
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative flex flex-col p-3.5 rounded-2xl border text-left',
        'transition-all duration-200 select-none overflow-hidden',
        'shadow-card hover:shadow-card-hover',
        'bg-[var(--color-surface)]',
        cfg.border,
        cfg.glow,
        pressed && 'scale-95',
        isSelected && 'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)]',
        !pressed && 'hover:-translate-y-0.5',
        table.hasNewItem && 'animate-pulse-slow'
      )}
    >
      {/* Status background tint */}
      <div className={cn('absolute inset-0 rounded-2xl opacity-30', cfg.bg)} />

      {/* New item pulse ring */}
      {table.hasNewItem && (
        <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-accent)]" />
        </span>
      )}

      <div className="relative z-10 flex flex-col h-full gap-2">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-[var(--color-text)] font-display leading-tight">
              {table.name}
            </p>
            {table.section && (
              <p className="text-[10px] text-[var(--color-text-muted)] font-body uppercase tracking-wider">
                {table.section}
              </p>
            )}
          </div>
          <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold font-body', cfg.bg, cfg.text)}>
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot,
              table.status === 'available' && 'animate-pulse'
            )} />
            {cfg.label}
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)] font-body">
          <span className="flex items-center gap-1">
            <Users size={10} />
            {table.capacity}
          </span>
          {table.openedAt && (
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatRelative(table.openedAt)}
            </span>
          )}
        </div>

        {/* Order total */}
        {table.activeOrderTotal !== undefined && table.status === 'occupied' && (
          <div className="flex items-center justify-between pt-1 mt-auto border-t border-[var(--color-border)]/50">
            <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] font-body">
              <Receipt size={10} />
              Toplam
            </span>
            <span className="text-sm font-bold font-mono text-[var(--color-text)]">
              {formatCurrency(table.activeOrderTotal)}
            </span>
          </div>
        )}

        {/* Waiter */}
        {table.waiterName && table.status === 'occupied' && (
          <p className="text-[10px] text-[var(--color-text-muted)] font-body truncate">
            👤 {table.waiterName}
          </p>
        )}
      </div>
    </button>
  )
}
