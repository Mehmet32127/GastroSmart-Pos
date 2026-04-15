import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/format'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: React.ReactNode
  className?: string
  closeOnOverlay?: boolean
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl mx-4',
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
  footer,
  className,
  closeOnOverlay = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 z-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      {/* Modal */}
      <div
        className={cn(
          'relative w-full z-10 bg-[var(--color-surface)] border border-[var(--color-border)]',
          'rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-bounce-in',
          sizeClasses[size],
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text)] font-display">{title}</h2>
              {subtitle && (
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5 font-body">{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Confirm Dialog
interface ConfirmProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export const ConfirmDialog: React.FC<ConfirmProps> = ({
  isOpen, onConfirm, onCancel, title, message,
  confirmText = 'Onayla', cancelText = 'İptal', danger = false,
}) => (
  <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm" closeOnOverlay={false}>
    <p className="text-sm text-[var(--color-text-muted)] font-body mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm rounded-xl bg-[var(--color-surface2)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface2)]/80 transition-colors font-body"
      >
        {cancelText}
      </button>
      <button
        onClick={onConfirm}
        className={cn(
          'px-4 py-2 text-sm rounded-xl font-medium transition-colors font-body',
          danger
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:brightness-110'
        )}
      >
        {confirmText}
      </button>
    </div>
  </Modal>
)
