import React from 'react'
import { Keyboard, X } from 'lucide-react'
import { SHORTCUTS_LIST } from '@/hooks/useKeyboardShortcuts'

/**
 * Klavye kısayolları rehberi modal'ı.
 * Ctrl+/ ile açılır, ESC veya X butonu ile kapanır.
 */
interface Props {
  isOpen: boolean
  onClose: () => void
}

export const ShortcutsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-card-hover p-6 animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard size={20} className="text-[var(--color-accent)]" />
            <h2 className="text-lg font-bold font-display text-[var(--color-text)]">
              Klavye Kısayolları
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="space-y-2">
          {SHORTCUTS_LIST.map(({ key, label }) => (
            <li
              key={key}
              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[var(--color-surface2)] transition-colors"
            >
              <span className="text-sm font-body text-[var(--color-text-muted)]">{label}</span>
              <kbd className="px-2 py-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-md text-xs font-mono font-semibold text-[var(--color-text)] min-w-[60px] text-center">
                {key}
              </kbd>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-xs text-[var(--color-text-muted)] text-center font-body">
          Profilinizden kısayolları kapatabilirsiniz.
        </p>
      </div>
    </div>
  )
}
