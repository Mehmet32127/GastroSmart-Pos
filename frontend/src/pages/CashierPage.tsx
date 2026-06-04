import React, { useEffect, useState, useCallback } from 'react'
import { Clock, RefreshCw, CreditCard, DollarSign, Receipt, Search, Wallet } from 'lucide-react'
import { PaymentModal } from '@/components/orders/PaymentModal'
import { Spinner, EmptyState } from '@/components/ui/common'
import { ordersApi } from '@/api/orders'
import { formatCurrency, cn } from '@/utils/format'
import type { Order } from '@/types'
import toast from 'react-hot-toast'

// Üst özet kartı
const StatBox: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; color: string }> = ({ icon, label, value, color }) => (
  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 shadow-card">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-[11px] text-[var(--color-text-muted)] font-body mb-0.5 truncate">{label}</p>
        <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      </div>
      <div className={`p-1.5 rounded-lg bg-[var(--color-surface2)] ${color} shrink-0`}>{icon}</div>
    </div>
  </div>
)

/**
 * KASA — ödeme alma / hesap kapatma ekranı.
 * Aktif Siparişler (izleme) sayfasından AYRI: burada her acik siparis kartina
 * tiklayinca odeme modali acilir. Sadece kasiyer + sahibi erisir (route guard).
 */
export const CashierPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
  const [query, setQuery] = useState('')

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await ordersApi.getAll({ status: 'open' })
      setOrders(data.data || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Siparişler yüklenemedi'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => {
    const interval = setInterval(loadOrders, 15000)
    return () => clearInterval(interval)
  }, [loadOrders])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadOrders()
    setRefreshing(false)
  }

  const handlePaymentSuccess = () => {
    setPaymentOrder(null)
    loadOrders()
  }

  const getElapsed = (createdAt: string) => {
    if (!createdAt) return '?'
    const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T')
    const date = new Date(normalized)
    if (isNaN(date.getTime())) return '?'
    const diff = Math.floor((Date.now() - date.getTime()) / 60000)
    if (diff < 0) return '0 dk'
    if (diff < 60) return `${diff} dk`
    return `${Math.floor(diff / 60)} sa ${diff % 60} dk`
  }

  const getOrderTotal = (order: Order) => {
    const items = order.items?.filter(i => i.status !== 'cancelled') || []
    return items.reduce((sum, i) => sum + i.totalPrice, 0)
  }

  const filtered = orders.filter(o =>
    !query || (o.tableName || '').toLowerCase().includes(query.toLowerCase())
  )

  const totalOpen = orders.reduce((s, o) => s + getOrderTotal(o), 0)
  const avgTicket = orders.length ? totalOpen / orders.length : 0

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
              <Wallet size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold font-display text-[var(--color-text)]">Kasa</h1>
              <p className="text-xs text-[var(--color-text-muted)] font-body">
                {orders.length} açık hesap · Tahsil edilecek <span className="text-[var(--color-accent)] font-semibold">{formatCurrency(totalOpen)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Masa ara..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/40 font-body w-28 sm:w-36" />
            </div>
            <button onClick={handleRefresh}
              className="p-2 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Özet şerit */}
        {!isLoading && orders.length > 0 && (
          <div className="grid grid-cols-3 gap-3 px-4 sm:px-5 pt-4">
            <StatBox icon={<Receipt size={16} />} label="Açık Hesap" value={orders.length} color="text-blue-400" />
            <StatBox icon={<DollarSign size={16} />} label="Tahsil Edilecek" value={formatCurrency(totalOpen)} color="text-[var(--color-accent)]" />
            <StatBox icon={<Receipt size={16} />} label="Ort. Adisyon" value={formatCurrency(avgTicket)} color="text-cyan-400" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Wallet size={24} />}
              title={orders.length === 0 ? 'Kapatılacak hesap yok' : 'Masa bulunamadı'}
              description={orders.length === 0 ? 'Şu an açık hesap bulunmuyor' : 'Bu aramayla eşleşen açık hesap yok'} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(order => {
                const elapsed = getElapsed(order.createdAt)
                const total = getOrderTotal(order)
                const items = order.items?.filter(i => i.status !== 'cancelled') || []
                return (
                  <button key={order.id} onClick={() => setPaymentOrder(order)}
                    className={cn(
                      'flex flex-col p-4 rounded-2xl border text-left transition-all duration-200',
                      'bg-[var(--color-surface)] hover:bg-[var(--color-surface2)] hover:-translate-y-0.5 active:scale-95',
                      'border-[var(--color-border)] hover:border-[var(--color-accent)]/40'
                    )}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <p className="text-base font-bold font-display text-[var(--color-text)] truncate">{order.tableName}</p>
                        <p className="text-xs text-[var(--color-text-muted)] font-body truncate">
                          {order.waiterName || (order.source === 'customer' ? '🔔 QR Müşteri' : '—')}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg bg-[var(--color-surface2)] text-[var(--color-text-muted)] flex-shrink-0">
                        <Clock size={10} />
                        {elapsed}
                      </span>
                    </div>

                    <div className="space-y-1 flex-1">
                      {items.slice(0, 3).map(item => (
                        <div key={item.id} className="flex justify-between items-center">
                          <span className="text-xs text-[var(--color-text-muted)] font-body truncate flex-1">{item.quantity}× {item.menuItemName}</span>
                          <span className="text-xs font-mono text-[var(--color-text-muted)] ml-2">{formatCurrency(item.totalPrice)}</span>
                        </div>
                      ))}
                      {items.length > 3 && (
                        <p className="text-xs text-[var(--color-text-muted)] font-body">+{items.length - 3} ürün daha</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]/50">
                      <span className="text-xs text-[var(--color-text-muted)] font-body">Toplam</span>
                      <span className="text-lg font-bold font-mono text-[var(--color-accent)]">{formatCurrency(total)}</span>
                    </div>

                    <span className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-sm font-bold font-body">
                      <CreditCard size={15} /> Ödeme Al
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {paymentOrder && (
        <PaymentModal isOpen={!!paymentOrder} onClose={() => setPaymentOrder(null)}
          order={paymentOrder} onSuccess={handlePaymentSuccess} />
      )}
    </>
  )
}
