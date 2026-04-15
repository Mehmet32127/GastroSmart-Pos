import React, { useState, useEffect } from 'react'
import { DollarSign, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/common'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { reportsApi } from '@/api/reports'
import { formatCurrency, formatDateTime } from '@/utils/format'
import { cn } from '@/utils/format'
import toast from 'react-hot-toast'

interface BanknoteRow { value: number; label: string; count: number }

const BANKNOTES: Omit<BanknoteRow, 'count'>[] = [
  { value: 200, label: '200 ₺' },
  { value: 100, label: '100 ₺' },
  { value: 50,  label: '50 ₺'  },
  { value: 20,  label: '20 ₺'  },
  { value: 10,  label: '10 ₺'  },
  { value: 5,   label: '5 ₺'   },
  { value: 1,   label: '1 ₺'   },
  { value: 0.5, label: '50 Kr' },
  { value: 0.25,label: '25 Kr' },
]

export const CashierPage: React.FC = () => {
  const [banknotes, setBanknotes] = useState<BanknoteRow[]>(
    BANKNOTES.map((b) => ({ ...b, count: 0 }))
  )
  const [expectedTotal, setExpectedTotal] = useState(0)
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [history, setHistory] = useState<Array<{ date: string; cashTotal: number; expectedTotal: number; difference: number }>>([])

  useEffect(() => {
    reportsApi.getDailyCiro()
      .then(({ data }) => setExpectedTotal(data.data?.cash || 0))
      .catch(() => {})
    reportsApi.getCashHistory({ limit: 5 })
      .then(({ data }) => setHistory((data.data as typeof history) || []))
      .catch(() => {})
  }, [])

  const countedTotal = banknotes.reduce((acc, b) => acc + b.value * b.count, 0)
  const difference = countedTotal - expectedTotal
  const isShort = difference < -0.01
  const isOver = difference > 0.01
  const isExact = Math.abs(difference) < 0.01

  const updateCount = (index: number, value: string) => {
    const count = Math.max(0, parseInt(value) || 0)
    setBanknotes((prev) => prev.map((b, i) => i === index ? { ...b, count } : b))
  }

  const handleClose = async () => {
    setIsClosing(true)
    try {
      const banknotesMap = banknotes.reduce((acc, b) => ({
        ...acc,
        [b.value]: b.count,
      }), {} as Record<number, number>)

      await reportsApi.closeCashRegister({ banknotes: banknotesMap, note })
      toast.success('Kasa kapatıldı!')
      setConfirmOpen(false)
      setBanknotes((prev) => prev.map((b) => ({ ...b, count: 0 })))
      setNote('')
      // Geçmiş listesini güncelle
      reportsApi.getCashHistory({ limit: 5 })
        .then(({ data }) => setHistory((data.data as typeof history) || []))
        .catch(() => {})
    } catch {
      toast.error('Kasa kapatılamadı')
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5 overflow-y-auto h-full">
      <div>
        <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Kasa Kapanışı</h1>
        <p className="text-sm text-[var(--color-text-muted)] font-body">Günlük kasa sayımı ve kapanış</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Banknote counter */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <h2 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4">Banknot Sayımı</h2>
            <div className="space-y-2">
              {banknotes.map((b, i) => (
                <div key={b.value} className="flex items-center gap-3">
                  <span className="w-16 text-sm font-mono text-[var(--color-text)] text-right">{b.label}</span>
                  <span className="text-[var(--color-text-muted)] text-xs font-body">×</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCount(i, String(Math.max(0, b.count - 1)))}
                      className="w-7 h-7 rounded-lg bg-[var(--color-surface2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center text-lg leading-none transition-colors"
                    >−</button>
                    <input
                      type="number"
                      value={b.count || ''}
                      onChange={(e) => updateCount(i, e.target.value)}
                      min={0}
                      className="w-16 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg px-2 py-1.5 text-sm font-mono text-center text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50"
                    />
                    <button
                      onClick={() => updateCount(i, String(b.count + 1))}
                      className="w-7 h-7 rounded-lg bg-[var(--color-surface2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center text-lg leading-none transition-colors"
                    >+</button>
                  </div>
                  <span className="flex-1 text-right text-sm font-mono text-[var(--color-text-muted)]">
                    {b.count > 0 ? formatCurrency(b.value * b.count) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div>
            <label className="text-sm font-medium text-[var(--color-text-muted)] font-body mb-1.5 block">
              Kapanış Notu
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Varsa açıklama..."
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/50 font-body resize-none"
            />
          </div>

          <Button
            fullWidth
            size="xl"
            variant={isShort ? 'danger' : 'primary'}
            icon={<DollarSign size={20} />}
            onClick={() => setConfirmOpen(true)}
          >
            Kasa Kapat
          </Button>
        </div>

        {/* Summary */}
        <div className="space-y-3">
          {/* Counted */}
          <Card padding="md">
            <p className="text-xs text-[var(--color-text-muted)] font-body mb-1">Sayılan Tutar</p>
            <p className="text-3xl font-bold font-mono text-[var(--color-accent)]">
              {formatCurrency(countedTotal)}
            </p>
          </Card>

          {/* Expected */}
          <Card padding="md">
            <p className="text-xs text-[var(--color-text-muted)] font-body mb-1">Beklenen (Sistem)</p>
            <p className="text-2xl font-bold font-mono text-[var(--color-text)]">
              {formatCurrency(expectedTotal)}
            </p>
          </Card>

          {/* Difference */}
          <Card padding="md" className={cn(
            'border',
            isExact ? 'border-green-500/30 bg-green-500/5' :
            isShort ? 'border-red-500/30 bg-red-500/5' :
            'border-blue-500/30 bg-blue-500/5'
          )}>
            <div className="flex items-center gap-2 mb-1">
              {isExact ? <CheckCircle size={14} className="text-green-400" /> :
               <AlertTriangle size={14} className={isShort ? 'text-red-400' : 'text-blue-400'} />}
              <p className="text-xs text-[var(--color-text-muted)] font-body">
                {isExact ? 'Tam' : isShort ? 'Eksik' : 'Fazla'}
              </p>
            </div>
            <p className={cn('text-2xl font-bold font-mono',
              isExact ? 'text-green-400' : isShort ? 'text-red-400' : 'text-blue-400'
            )}>
              {isExact ? '—' : (isShort ? '-' : '+') + formatCurrency(Math.abs(difference))}
            </p>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <Card padding="md">
              <h3 className="text-xs font-semibold font-display text-[var(--color-text)] mb-3 flex items-center gap-1.5">
                <Clock size={12} /> Son Kapanışlar
              </h3>
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs font-body">
                    <span className="text-[var(--color-text-muted)]">{formatDateTime(h.date)}</span>
                    <span className={cn('font-mono font-medium',
                      Math.abs(h.difference) < 0.01 ? 'text-green-400' :
                      h.difference < 0 ? 'text-red-400' : 'text-blue-400'
                    )}>
                      {h.difference === 0 ? '✓' : (h.difference > 0 ? '+' : '') + formatCurrency(h.difference)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onConfirm={handleClose}
        onCancel={() => setConfirmOpen(false)}
        title="Kasa Kapatılsın mı?"
        message={
          isShort
            ? `Kasada ${formatCurrency(Math.abs(difference))} eksik. Yine de kapatmak istiyor musunuz?`
            : isOver
              ? `Kasada ${formatCurrency(difference)} fazla var. Yine de kapatmak istiyor musunuz?`
              : `Kasa tutarı doğru. Günlük kapanış yapılsın mı?`
        }
        confirmText="Evet, Kapat"
        danger={isShort}
      />
    </div>
  )
}
