import React, { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency, cn } from '@/utils/format'
import { ordersApi } from '@/api/orders'
import type { Order } from '@/types'
import toast from 'react-hot-toast'

type PaymentMethod = 'cash' | 'card' | 'mixed' | 'complimentary'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order
  onSuccess: () => void
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, order, onSuccess }) => {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [cashInput, setCashInput] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const items = order.items?.filter(i => i.status !== 'cancelled') || []
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0)
  const discountAmount = discountType === 'percent'
    ? subtotal * (discount / 100)
    : Math.min(discount, subtotal)
  const total = Math.max(0, subtotal - discountAmount)

  // Karma ödeme için nakit/kart dağılımı
  const mixedCash = Math.min(Math.max(0, cashInput), total)
  const mixedCard = parseFloat((total - mixedCash).toFixed(2))

  useEffect(() => {
    if (isOpen) {
      setMethod('cash')
      setNote('')
      setDiscount(0)
      setDiscountType('percent')
      setCashInput(0)
    }
  }, [isOpen])

  // Yöntem değişince karma girişini sıfırla
  useEffect(() => { setCashInput(0) }, [method])

  const handleComplete = async () => {
    if (method === 'mixed' && mixedCash <= 0) {
      toast.error('Karma ödemede nakit tutarı sıfırdan büyük olmalı')
      return
    }
    setIsLoading(true)
    try {
      await ordersApi.close(order.id, {
        paymentMethod: method,
        paidAmount:    total,
        cashAmount:    method === 'cash'  ? total
                     : method === 'mixed' ? mixedCash
                     : undefined,
        cardAmount:    method === 'card'  ? total
                     : method === 'mixed' ? mixedCard
                     : undefined,
        discount,
        discountType,
        note: note || undefined,
      })
      toast.success('Ödeme tamamlandı!')
      onSuccess()
    } catch {
      toast.error('Ödeme tamamlanamadı')
    } finally {
      setIsLoading(false)
    }
  }

  const METHODS: { key: PaymentMethod; icon: string; label: string }[] = [
    { key: 'cash',          icon: '💵', label: 'Nakit'  },
    { key: 'card',          icon: '💳', label: 'Kart'   },
    { key: 'mixed',         icon: '🔀', label: 'Karma'  },
    { key: 'complimentary', icon: '🎁', label: 'İkram'  },
  ]

  const methodInfo: Record<PaymentMethod, { color: string; msg: string }> = {
    cash:          { color: 'green',  msg: `💵 Nakit: ${formatCurrency(total)} alınacak` },
    card:          { color: 'blue',   msg: '💳 Kart ile ödeme onaylanacak' },
    mixed:         { color: 'purple', msg: '🔀 Nakit + Kart ile ödeme' },
    complimentary: { color: 'amber',  msg: '🎁 Bu sipariş ikram olarak kaydedilecek' },
  }

  const info = methodInfo[method]

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ödeme Al"
      subtitle={`${order.tableName} — ${items.length} ürün`} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} icon={<X size={15} />}>İptal</Button>
          <Button onClick={handleComplete} loading={isLoading} icon={<Check size={15} />}>
            Ödemeyi Tamamla
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Ürünler */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-[var(--color-border)]/50">
              <span className="text-sm text-[var(--color-text)] font-body truncate flex-1">{item.quantity}× {item.menuItemName}</span>
              <span className="text-sm font-mono text-[var(--color-text-muted)] ml-3">{formatCurrency(item.totalPrice)}</span>
            </div>
          ))}
        </div>

        {/* İndirim */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">İndirim (isteğe bağlı)</label>
          <div className="flex gap-2">
            <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
              <button onClick={() => setDiscountType('percent')}
                className={`px-3 py-2 text-sm font-body transition-colors ${discountType === 'percent' ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)]'}`}>
                %
              </button>
              <button onClick={() => setDiscountType('amount')}
                className={`px-3 py-2 text-sm font-body transition-colors ${discountType === 'amount' ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]' : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)]'}`}>
                ₺
              </button>
            </div>
            <input type="number" min="0" value={discount || ''}
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="flex-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none focus:border-[var(--color-accent)]/50" />
          </div>
        </div>

        {/* Toplam */}
        <div className="bg-[var(--color-surface2)] rounded-2xl p-4 text-center border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] font-body mb-1">Ödenecek Tutar</p>
          <p className="text-3xl font-bold font-mono text-[var(--color-accent)]">{formatCurrency(total)}</p>
          {discountAmount > 0 && (
            <p className="text-xs text-green-400 font-body mt-1">-{formatCurrency(discountAmount)} indirim uygulandı</p>
          )}
        </div>

        {/* Ödeme yöntemi */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Ödeme Yöntemi</label>
          <div className="grid grid-cols-4 gap-2">
            {METHODS.map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all font-body ${
                  method === m.key
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/30'
                }`}>
                <span className="text-xl">{m.icon}</span>
                <span className="text-xs font-medium">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Karma ödeme: nakit/kart dağılımı */}
        {method === 'mixed' && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">
              Nakit Tutar ({formatCurrency(mixedCard)} kart olarak kalır)
            </label>
            <input
              type="number" min="0" max={total} step="0.01"
              value={cashInput || ''}
              onChange={e => setCashInput(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:outline-none focus:border-[var(--color-accent)]/50"
            />
          </div>
        )}

        {/* Yöntem bilgisi */}
        <div className={cn(
          'rounded-xl p-3 text-center border',
          method === 'cash' && 'bg-green-500/10 border-green-500/30',
          method === 'card' && 'bg-blue-500/10 border-blue-500/30',
          method === 'mixed' && 'bg-purple-500/10 border-purple-500/30',
          method === 'complimentary' && 'bg-amber-500/10 border-amber-500/30'
        )}>
          <p className={cn(
            'text-sm font-body',
            method === 'cash' && 'text-green-400',
            method === 'card' && 'text-blue-400',
            method === 'mixed' && 'text-purple-400',
            method === 'complimentary' && 'text-amber-400'
          )}>{info.msg}</p>
        </div>

        {/* Not */}
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="Ödeme notu (isteğe bağlı)"
          className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 font-body" />
      </div>
    </Modal>
  )
}
