import React, { useState, useEffect } from 'react'
import { Calculator as CalcIcon, X, Delete } from 'lucide-react'
import { formatCurrency } from '@/utils/format'

/**
 * Basit hesap makinesi modal'ı.
 *
 * Kasiyer için kullanışlı:
 *   - Müşteri 200₺ verdi, hesap 137.50, üstü hesapla
 *   - Birden fazla siparişi topla, indirim yüzdesi uygula
 *
 * Davranış:
 *   - 4 işlem (+, −, ×, ÷)
 *   - Yüzde tuşu (% — son sayının yüzdesini al)
 *   - C: temizle, AC: tam sıfırla
 *   - Klavye desteği: 0-9, + - asterisk slash, Enter (=), Backspace, ESC
 */

interface Props {
  isOpen: boolean
  onClose: () => void
}

type Op = '+' | '-' | '*' | '/' | null

export const CalculatorModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0')
  const [previous, setPrevious] = useState<number | null>(null)
  const [op, setOp] = useState<Op>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const clear = () => {
    setDisplay('0')
    setPrevious(null)
    setOp(null)
    setWaitingForOperand(false)
  }

  const inputDigit = (d: string) => {
    if (waitingForOperand) {
      setDisplay(d)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === '0' ? d : display + d)
    }
  }

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.')
      setWaitingForOperand(false)
      return
    }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  const performOp = (nextOp: Op) => {
    const current = parseFloat(display)

    if (previous == null) {
      setPrevious(current)
    } else if (op) {
      const result = calculate(previous, current, op)
      setPrevious(result)
      setDisplay(String(result))
    }

    setOp(nextOp)
    setWaitingForOperand(true)
  }

  const calculate = (a: number, b: number, operator: Op): number => {
    switch (operator) {
      case '+': return parseFloat((a + b).toFixed(2))
      case '-': return parseFloat((a - b).toFixed(2))
      case '*': return parseFloat((a * b).toFixed(2))
      case '/': return b === 0 ? 0 : parseFloat((a / b).toFixed(2))
      default:  return b
    }
  }

  const equals = () => {
    if (op == null || previous == null) return
    const result = calculate(previous, parseFloat(display), op)
    setDisplay(String(result))
    setPrevious(null)
    setOp(null)
    setWaitingForOperand(true)
  }

  const percent = () => {
    setDisplay(String(parseFloat(display) / 100))
  }

  const backspace = () => {
    if (display.length === 1) setDisplay('0')
    else setDisplay(display.slice(0, -1))
  }

  // Klavye desteği
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key >= '0' && e.key <= '9') { e.preventDefault(); inputDigit(e.key) }
      else if (e.key === '.' || e.key === ',') { e.preventDefault(); inputDot() }
      else if (['+', '-', '*', '/'].includes(e.key)) { e.preventDefault(); performOp(e.key as Op) }
      else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals() }
      else if (e.key === 'Backspace') { e.preventDefault(); backspace() }
      else if (e.key === '%') { e.preventDefault(); percent() }
      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); clear() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, display, previous, op, waitingForOperand])

  if (!isOpen) return null

  const Btn: React.FC<{ children: React.ReactNode; onClick: () => void; variant?: 'num' | 'op' | 'eq' | 'clear' }> = ({ children, onClick, variant = 'num' }) => {
    const styles = {
      num:   'bg-[var(--color-surface2)] text-[var(--color-text)] hover:bg-[var(--color-border)]',
      op:    'bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 font-bold',
      eq:    'bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:opacity-90 font-bold',
      clear: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 font-bold',
    }
    return (
      <button
        onClick={onClick}
        className={`h-14 rounded-xl text-lg font-display transition-colors active:scale-95 ${styles[variant]}`}
      >
        {children}
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl shadow-card-hover p-5 animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalcIcon size={18} className="text-[var(--color-accent)]" />
            <h2 className="text-base font-bold font-display text-[var(--color-text)]">Hesap Makinesi</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Ekran — canlı önizleme: previous op display varsa sonucu göster */}
        {(() => {
          // Eğer bir işlem bekliyorsa (previous + op) ve display geçerli sayı ise,
          // SONUCU canlı hesapla, alta yazdır. Yoksa sadece display'in TL gösterimi.
          const livePreview = (op != null && previous != null && !waitingForOperand)
            ? calculate(previous, parseFloat(display) || 0, op)
            : null
          return (
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-2xl p-4 mb-4 text-right">
              {op && previous != null && (
                <div className="text-xs text-[var(--color-text-muted)] font-mono">{previous} {op}</div>
              )}
              <div className="text-3xl font-bold font-mono text-[var(--color-text)] break-all">
                {display}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] font-body mt-1">
                {livePreview !== null ? (
                  <>= <span className="text-[var(--color-accent)] font-semibold">{formatCurrency(livePreview)}</span></>
                ) : (
                  <>≈ {formatCurrency(parseFloat(display) || 0)}</>
                )}
              </div>
            </div>
          )
        })()}

        {/* Tuşlar */}
        <div className="grid grid-cols-4 gap-2">
          <Btn onClick={clear} variant="clear">C</Btn>
          <Btn onClick={backspace} variant="op"><Delete size={16} className="mx-auto" /></Btn>
          <Btn onClick={percent} variant="op">%</Btn>
          <Btn onClick={() => performOp('/')} variant="op">÷</Btn>

          <Btn onClick={() => inputDigit('7')}>7</Btn>
          <Btn onClick={() => inputDigit('8')}>8</Btn>
          <Btn onClick={() => inputDigit('9')}>9</Btn>
          <Btn onClick={() => performOp('*')} variant="op">×</Btn>

          <Btn onClick={() => inputDigit('4')}>4</Btn>
          <Btn onClick={() => inputDigit('5')}>5</Btn>
          <Btn onClick={() => inputDigit('6')}>6</Btn>
          <Btn onClick={() => performOp('-')} variant="op">−</Btn>

          <Btn onClick={() => inputDigit('1')}>1</Btn>
          <Btn onClick={() => inputDigit('2')}>2</Btn>
          <Btn onClick={() => inputDigit('3')}>3</Btn>
          <Btn onClick={() => performOp('+')} variant="op">+</Btn>

          <button
            onClick={() => inputDigit('0')}
            className="h-14 rounded-xl text-lg font-display col-span-2 bg-[var(--color-surface2)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors active:scale-95"
          >0</button>
          <Btn onClick={inputDot}>,</Btn>
          <Btn onClick={equals} variant="eq">=</Btn>
        </div>

        <p className="mt-3 text-[10px] text-center text-[var(--color-text-muted)] font-body">
          Klavye desteği: 0-9, + − × ÷, Enter, Backspace, ESC
        </p>
      </div>
    </div>
  )
}
