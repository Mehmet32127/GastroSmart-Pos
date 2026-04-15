import React, { useEffect, useState, useCallback } from 'react'
import { Search, ChevronDown, ChevronRight, Receipt } from 'lucide-react'
import { Spinner, EmptyState } from '@/components/ui/common'
import { ordersApi } from '@/api/orders'
import { formatCurrency, formatDateTime } from '@/utils/format'
import type { Order } from '@/types'

const METHOD_LABELS: Record<string, string> = {
  cash: '💵 Nakit', card: '💳 Kart', mixed: '🔀 Karma', complimentary: '🎁 İkram',
}

export const HistoryPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 25

  const load = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const { data } = await ordersApi.getAll({ status: 'closed', page: p, limit: LIMIT })
      const items = data.data || []
      if (p === 1) setOrders(items)
      else setOrders((prev) => [...prev, ...items])
      setHasMore(items.length === LIMIT)
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load(1) }, [load])

  const filtered = orders.filter((o) =>
    !search ||
    o.tableName.toLowerCase().includes(search.toLowerCase()) ||
    o.waiterName.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toString().includes(search)
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex-1">
          <h1 className="text-lg font-bold font-display text-[var(--color-text)]">Sipariş Geçmişi</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-body">{orders.length} kayıt</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Masa, garson, sipariş No..."
            className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none font-body w-52" />
        </div>
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider font-body border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="col-span-1">#</div>
        <div className="col-span-2">Masa</div>
        <div className="col-span-2">Garson</div>
        <div className="col-span-3">Tarih</div>
        <div className="col-span-1">Ödeme</div>
        <div className="col-span-2 text-right">Toplam</div>
        <div className="col-span-1"></div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && orders.length === 0 ? (
          <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Receipt size={24} />} title="Sipariş bulunamadı" />
        ) : (
          <div>
            {filtered.map((order) => (
              <div key={order.id} className="border-b border-[var(--color-border)]">
                <button
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  className="w-full grid grid-cols-12 gap-3 px-5 py-3 text-left hover:bg-[var(--color-surface)] transition-colors items-center"
                >
                  <div className="col-span-1">
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">#{order.id}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm font-semibold text-[var(--color-text)] font-body">{order.tableName}</span>
                  </div>
                  <div className="col-span-2 hidden md:block">
                    <span className="text-xs text-[var(--color-text-muted)] font-body">{order.waiterName}</span>
                  </div>
                  <div className="col-span-3 hidden md:block">
                    <span className="text-xs text-[var(--color-text-muted)] font-body">
                      {order.closedAt ? formatDateTime(order.closedAt) : '—'}
                    </span>
                  </div>
                  <div className="col-span-1 hidden md:block">
                    <span className="text-xs font-body">
                      {order.paymentMethod ? METHOD_LABELS[order.paymentMethod] : '—'}
                    </span>
                  </div>
                  <div className="col-span-2 md:col-span-2 text-right">
                    <span className="text-sm font-bold font-mono text-[var(--color-accent)]">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {expanded === order.id ? <ChevronDown size={14} className="text-[var(--color-text-muted)]" /> : <ChevronRight size={14} className="text-[var(--color-text-muted)]" />}
                  </div>
                </button>

                {/* Expanded items */}
                {expanded === order.id && (
                  <div className="px-5 pb-4 bg-[var(--color-surface)] animate-slide-up">
                    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[var(--color-surface2)] text-[10px] text-[var(--color-text-muted)] font-body uppercase tracking-wider">
                        <div className="col-span-5">Ürün</div>
                        <div className="col-span-2 text-center">Adet</div>
                        <div className="col-span-2 text-right">Birim</div>
                        <div className="col-span-3 text-right">Toplam</div>
                      </div>
                      {order.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-[var(--color-border)] items-center">
                          <div className="col-span-5">
                            <p className="text-xs text-[var(--color-text)] font-body">{item.menuItemName}</p>
                            {item.note && <p className="text-[10px] text-amber-400/70 font-body italic">{item.note}</p>}
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-xs font-mono text-[var(--color-text-muted)]">{item.quantity}</span>
                          </div>
                          <div className="col-span-2 text-right">
                            <span className="text-xs font-mono text-[var(--color-text-muted)]">{formatCurrency(item.unitPrice)}</span>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-xs font-mono text-[var(--color-text)]">{formatCurrency(item.totalPrice)}</span>
                          </div>
                        </div>
                      ))}
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface2)]">
                        <div className="col-span-9 text-xs font-semibold text-[var(--color-text)] font-body text-right">TOPLAM</div>
                        <div className="col-span-3 text-right">
                          <span className="text-sm font-bold font-mono text-[var(--color-accent)]">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                      {order.discount > 0 && (
                        <div className="px-3 py-1.5 border-t border-[var(--color-border)] flex justify-between text-xs font-body text-green-400">
                          <span>İndirim ({order.discountType === 'percent' ? `%${order.discount}` : formatCurrency(order.discount)})</span>
                          <span className="font-mono">-{formatCurrency(order.discountType === 'percent' ? order.subtotal * order.discount / 100 : order.discount)}</span>
                        </div>
                      )}
                      {order.change > 0 && (
                        <div className="px-3 py-1.5 border-t border-[var(--color-border)] flex justify-between text-xs font-body text-blue-400">
                          <span>Para Üstü</span>
                          <span className="font-mono">{formatCurrency(order.change)}</span>
                        </div>
                      )}
                    </div>

                    {/* Waiter + timestamp */}
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--color-text-muted)] font-body">
                      <span>👤 {order.waiterName}</span>
                      <span>🕐 {order.openedAt ? formatDateTime(order.openedAt) : ''}</span>
                      <span>{order.paymentMethod ? METHOD_LABELS[order.paymentMethod] : ''}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="p-4 text-center">
                <button onClick={() => { setPage(p => p + 1); load(page + 1) }}
                  className="text-sm text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 font-body transition-colors">
                  Daha fazla yükle...
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
