import React, { useEffect, useState, useCallback } from 'react'
import { Clock, RefreshCw } from 'lucide-react'
import { PaymentModal } from '@/components/orders/PaymentModal'
import { Spinner, EmptyState } from '@/components/ui/common'
import { ordersApi } from '@/api/orders'
import { formatCurrency, cn } from '@/utils/format'
import { useAuthStore } from '@/store/authStore'
import type { Order } from '@/types'
import toast from 'react-hot-toast'

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null)
  // Sadece kasiyer/sahibi ödeme alır — garson/müdür için karte tıklama bilgi ver
  const canCloseOrder = useAuthStore((s) => s.hasRole(['admin', 'cashier']))

  const loadOrders = useCallback(async () => {
    try {
      const { data } = await ordersApi.getAll({ status: 'open' })
      setOrders(data.data || [])
    } catch (error) {
      console.error('❌ Orders API error:', error)
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

  const handleApprove = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation()
    try {
      await ordersApi.approve(orderId)
      toast.success('Müşteri siparişi onaylandı')
      loadOrders()
    } catch {
      toast.error('Onaylanamadı')
    }
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

  const isOrderLate = (order: Order) => {
    const c = order.createdAt || ''
    const n = c.includes('T') ? c : c.replace(' ', 'T')
    const t = new Date(n).getTime()
    return !isNaN(t) && Date.now() - t > 30 * 60 * 1000
  }

  // Üst özet — geciken sipariş sayısı + tüm açık siparişlerin toplam tutarı
  const lateCount = orders.filter(isOrderLate).length
  const totalOpen = orders.reduce((s, o) => s + getOrderTotal(o), 0)

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div>
            <h1 className="text-lg font-bold font-display text-[var(--color-text)]">Aktif Siparişler</h1>
            <p className="text-xs text-[var(--color-text-muted)] font-body">
              {orders.length} açık sipariş
              {lateCount > 0 && <> · <span className="text-red-400 font-semibold">{lateCount} geç</span></>}
              {totalOpen > 0 && <> · <span className="text-[var(--color-accent)] font-semibold">{formatCurrency(totalOpen)}</span></>}
            </p>
          </div>
          <button onClick={handleRefresh}
            className="p-2 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
          ) : orders.length === 0 ? (
            <EmptyState icon={<Clock size={24} />} title="Aktif sipariş yok" description="Şu an açık sipariş bulunmuyor" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {orders.map(order => {
                const elapsed = getElapsed(order.createdAt)
                const total = getOrderTotal(order)
                const items = order.items?.filter(i => i.status !== 'cancelled') || []
                const pending   = items.filter(i => i.status === 'pending').length
                const preparing = items.filter(i => i.status === 'preparing').length
                const served    = items.filter(i => i.status === 'served').length
                const createdAtStr = order.createdAt || new Date().toISOString()
                const isLate = Date.now() - new Date(
                  createdAtStr.includes('T') ? createdAtStr : createdAtStr.replace(' ', 'T')
                ).getTime() > 30 * 60 * 1000

                return (
                  <button key={order.id} onClick={() => {
                    if (!canCloseOrder) {
                      toast('Hesap kapatma yetkisi sadece Kasiyer ve Sahibinde', { icon: 'ℹ️' })
                      return
                    }
                    setPaymentOrder(order)
                  }}
                    className={cn(
                      'flex flex-col p-4 rounded-2xl border text-left transition-all duration-200',
                      'bg-[var(--color-surface)] hover:bg-[var(--color-surface2)] hover:-translate-y-0.5 active:scale-95',
                      isLate ? 'border-red-500/30' : 'border-[var(--color-border)]'
                    )}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-base font-bold font-display text-[var(--color-text)]">{order.tableName}</p>
                        <p className="text-xs text-[var(--color-text-muted)] font-body">
                          {order.waiterName || (order.source === 'customer' ? '🔔 QR Müşteri' : '—')}
                        </p>
                      </div>
                      <span className={cn(
                        'flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg',
                        isLate ? 'bg-red-500/15 text-red-400' : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)]'
                      )}>
                        <Clock size={10} />
                        {elapsed}
                      </span>
                    </div>

                    {(pending > 0 || preparing > 0 || served > 0) && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {pending > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400">{pending} bekliyor</span>}
                        {preparing > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400">{preparing} hazırlanıyor</span>}
                        {served > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-green-500/15 text-green-400">{served} servis</span>}
                      </div>
                    )}

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
                      <span className="text-xs text-[var(--color-text-muted)] font-body">Toplam Tutar</span>
                      <span className="text-lg font-bold font-mono text-[var(--color-accent)]">{formatCurrency(total)}</span>
                    </div>

                    {order.source === 'customer' && pending > 0 && (
                      <span role="button" tabIndex={0}
                        onClick={(e) => handleApprove(e, order.id)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-semibold font-body hover:bg-[var(--color-accent)]/25 transition-colors cursor-pointer">
                        🔔 Müşteri siparişi — Onayla
                      </span>
                    )}
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
