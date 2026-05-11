import React, { useState, useEffect } from 'react'
import { Search, Plus, Minus, Trash2, MessageSquare, X, ChevronLeft, ShoppingBag, Ban, StickyNote, Check } from 'lucide-react'
import { cn, formatCurrency } from '@/utils/format'
import { Input } from '@/components/ui/Input'
import { useOrderStore } from '@/store/orderStore'
import { useTableStore } from '@/store/tableStore'
import { menuApi } from '@/api/menu'
import { ordersApi } from '@/api/orders'
import { tablesApi } from '@/api/tables'
import type { Table, MenuItem, Category } from '@/types'
import toast from 'react-hot-toast'

type PanelView = 'order' | 'menu'

interface OrderPanelProps {
  table: Table
  onClose: () => void
}

export const OrderPanel: React.FC<OrderPanelProps> = ({ table, onClose }) => {
  const { currentOrder, setCurrentOrder, calculateTotals } = useOrderStore()
  const [view, setView] = useState<PanelView>('order')
  const [categories, setCategories] = useState<Category[]>([])
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editNoteItemId, setEditNoteItemId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const guestCount = 1  // Varsayılan 1; sipariş açıldıktan sonra güncellenebilir

  // Masa notu — sticky note (alerji, doğum günü, vs)
  const updateTableLocal = useTableStore((s) => s.updateTable)
  const [tableNote, setTableNote] = useState(table.note || '')
  const [savingNote, setSavingNote] = useState(false)

  const saveTableNote = async () => {
    if (tableNote === (table.note || '')) return
    setSavingNote(true)
    try {
      const { data } = await tablesApi.updateNote(table.id, tableNote.trim())
      if (data.data) updateTableLocal(data.data)
      toast.success(tableNote.trim() ? 'Not kaydedildi' : 'Not silindi')
    } catch {
      toast.error('Not kaydedilemedi')
    } finally {
      setSavingNote(false)
    }
  }

  const { subtotal, taxTotal, total } = calculateTotals()

  useEffect(() => {
    const load = async () => {
      try {
        const [catRes, itemRes] = await Promise.all([
          menuApi.getCategories(),
          menuApi.getItems({ active: true }),
        ])
        setCategories(catRes.data.data || [])
        setMenuItems(itemRes.data.data || [])
        if (catRes.data.data?.[0]) setSelectedCategory(catRes.data.data[0].id)
      } catch { toast.error('Menü yüklenemedi') }
    }
    load()
  }, [])

  useEffect(() => {
    if (!table.currentOrderId) return
    ordersApi.getById(table.currentOrderId).then(({ data }) => {
      if (data.data) setCurrentOrder(data.data)
    }).catch(() => {})
  }, [table.currentOrderId])

  const filteredItems = menuItems.filter(item => {
    const matchCat = !selectedCategory || item.categoryId === selectedCategory
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  const handleAddItem = async (item: MenuItem) => {
    if (isLoading) return
    setIsLoading(true)
    try {
      let order = currentOrder
      if (!order) {
        const { data } = await ordersApi.create({ tableId: table.id, guestCount })
        order = data.data!
        setCurrentOrder(order)
      }
      await ordersApi.addItem(order.id, { menuItemId: item.id, quantity: 1 })
      const { data: orderData } = await ordersApi.getById(order.id)
      if (orderData.data) setCurrentOrder(orderData.data)
      toast.success(item.name + ' eklendi', { duration: 800, icon: '✓' })
    } catch { toast.error('Eklenemedi') }
    finally { setIsLoading(false) }
  }

  const handleUpdateQuantity = async (itemId: string, delta: number) => {
    if (!currentOrder) return
    const item = currentOrder.items.find(i => i.id === itemId)
    if (!item) return
    const newQty = item.quantity + delta
    if (newQty <= 0) {
      try {
        await ordersApi.removeItem(currentOrder.id, itemId)
        const { data } = await ordersApi.getById(currentOrder.id)
        if (data.data) setCurrentOrder(data.data)
      } catch { toast.error('Silinemedi') }
      return
    }
    try {
      await ordersApi.updateItem(currentOrder.id, itemId, { quantity: newQty })
      const { data } = await ordersApi.getById(currentOrder.id)
      if (data.data) setCurrentOrder(data.data)
    } catch { toast.error('Güncellenemedi') }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!currentOrder) return
    try {
      await ordersApi.removeItem(currentOrder.id, itemId)
      const { data } = await ordersApi.getById(currentOrder.id)
      if (data.data) setCurrentOrder(data.data)
    } catch { toast.error('Silinemedi') }
  }

  const handleCancelOrder = async () => {
    if (cancelLoading) return
    // currentOrder yoksa ama masada sipariş ID'si varsa onu kullan
    const orderId = currentOrder?.id ?? table.currentOrderId
    if (!orderId) { onClose(); return }
    setCancelLoading(true)
    try {
      await ordersApi.cancel(orderId)
      toast.success('Masa boşaltıldı')
      setCurrentOrder(null)
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'İptal edilemedi'
      toast.error(msg)
    } finally {
      setCancelLoading(false)
      setCancelConfirm(false)
    }
  }

  const handleSaveNote = async (itemId: string) => {
    if (!currentOrder) return
    try {
      await ordersApi.updateItem(currentOrder.id, itemId, { note: noteText })
      const { data } = await ordersApi.getById(currentOrder.id)
      if (data.data) setCurrentOrder(data.data)
      setEditNoteItemId(null)
      setNoteText('')
    } catch { toast.error('Not kaydedilemedi') }
  }

  const activeItems = currentOrder?.items.filter(i => i.status !== 'cancelled') || []

  return (
    // Backdrop — boşluğa tıklayınca kapat
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
      {/* Panel — tıklamayı durdur */}
      <div className="flex flex-col bg-[var(--color-bg)] w-full max-w-2xl h-full shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {view === 'order' ? (
          <>
            {/* Başlık */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
              <div>
                <h2 className="font-display font-bold text-[var(--color-text)] text-2xl">{table.name}</h2>
                <p className="text-sm text-[var(--color-text-muted)] font-body mt-0.5">
                  {activeItems.length === 0 ? 'Henüz sipariş yok' : `${activeItems.length} ürün`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Masayı İptal Et */}
                {!cancelConfirm ? (
                  <button onClick={() => setCancelConfirm(true)}
                    title="Masayı İptal Et"
                    className="p-3 rounded-2xl text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                    <Ban size={20} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-2xl px-3 py-2">
                    <span className="text-sm text-red-400 font-body font-medium">Masayı iptal et?</span>
                    <button onClick={handleCancelOrder} disabled={cancelLoading}
                      className="px-3 py-1 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                      {cancelLoading ? '...' : 'Evet'}
                    </button>
                    <button onClick={() => setCancelConfirm(false)} disabled={cancelLoading}
                      className="px-3 py-1 rounded-xl bg-[var(--color-surface2)] text-[var(--color-text-muted)] text-xs font-body hover:bg-[var(--color-border)] disabled:opacity-40 transition-colors">
                      Hayır
                    </button>
                  </div>
                )}
                <button onClick={onClose}
                  className="p-3 rounded-2xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] transition-colors">
                  <X size={22} />
                </button>
                <button onClick={() => setView('menu')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-base font-semibold hover:brightness-110 transition-all active:scale-95">
                  <Plus size={20} />
                  Ürün Ekle
                </button>
              </div>
            </div>

            {/* Masa notu (sticky) — alerjisi, doğum günü, sessiz köşe vb */}
            <div className="px-6 py-2 border-b border-[var(--color-border)] bg-yellow-400/5 flex items-center gap-2">
              <StickyNote size={14} className="text-yellow-400 flex-shrink-0" />
              <input
                value={tableNote}
                onChange={(e) => setTableNote(e.target.value.slice(0, 200))}
                onBlur={saveTableNote}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder="Masaya not bırak (ör: Doğum günü, çocuklu aile, alerjisi var)..."
                className="flex-1 bg-transparent text-sm font-body text-[var(--color-text)] placeholder-[var(--color-text-muted)]/60 focus:outline-none"
                disabled={savingNote}
              />
              {tableNote !== (table.note || '') && (
                <button
                  onClick={saveTableNote}
                  disabled={savingNote}
                  className="px-2 py-1 rounded-lg bg-yellow-400/20 text-yellow-300 text-xs font-semibold hover:bg-yellow-400/30 disabled:opacity-50 flex items-center gap-1"
                >
                  <Check size={12} /> Kaydet
                </button>
              )}
            </div>

            {/* Sipariş listesi */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-20 h-20 rounded-3xl bg-[var(--color-surface2)] flex items-center justify-center">
                    <ShoppingBag size={36} className="text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-[var(--color-text-muted)] font-body text-lg">Sipariş boş</p>
                  <button onClick={() => setView('menu')}
                    className="px-6 py-3 rounded-2xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-base font-medium hover:bg-[var(--color-accent)]/25 transition-colors">
                    Menüden ürün seç
                  </button>
                </div>
              ) : (
                activeItems.map(item => (
                  <div key={item.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-[var(--color-text)] font-body">{item.menuItemName}</p>
                        <p className="text-sm text-[var(--color-text-muted)] font-mono">{formatCurrency(item.unitPrice)} / adet</p>
                      </div>
                      <p className="text-lg font-bold font-mono text-[var(--color-accent)]">{formatCurrency(item.totalPrice)}</p>
                    </div>

                    {editNoteItemId === item.id ? (
                      <div className="mt-3 flex gap-2">
                        <input autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                          placeholder="Not ekle..."
                          className="flex-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none font-body"
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(item.id) }} />
                        <button onClick={() => handleSaveNote(item.id)}
                          className="px-4 py-2.5 rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent)] text-sm font-medium">Kaydet</button>
                        <button onClick={() => setEditNoteItemId(null)}
                          className="px-3 py-2.5 rounded-xl bg-[var(--color-surface2)] text-[var(--color-text-muted)] text-sm">✕</button>
                      </div>
                    ) : item.note ? (
                      <button onClick={() => { setEditNoteItemId(item.id); setNoteText(item.note || '') }}
                        className="mt-2 text-xs text-amber-400/80 hover:text-amber-400 truncate w-full text-left">
                        📝 {item.note}
                      </button>
                    ) : null}

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]/50">
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-11 h-11 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-500/30 transition-colors active:scale-95">
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center text-lg font-bold font-mono text-[var(--color-text)]">{item.quantity}</span>
                        <button onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-11 h-11 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-green-400 hover:border-green-500/30 transition-colors active:scale-95">
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditNoteItemId(item.id); setNoteText(item.note || '') }}
                          className="w-11 h-11 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-amber-400 transition-colors">
                          <MessageSquare size={16} />
                        </button>
                        <button onClick={() => handleDeleteItem(item.id)}
                          className="w-11 h-11 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-500/30 transition-colors active:scale-95">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Alt: Toplam + Siparişi Kaydet */}
            {activeItems.length > 0 && (
              <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-3 flex-shrink-0">
                <div className="space-y-1.5 text-sm font-body">
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Ara Toplam</span><span className="font-mono">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>KDV</span><span className="font-mono">{formatCurrency(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-[var(--color-text)] pt-2 border-t border-[var(--color-border)]">
                    <span className="font-display">Toplam</span>
                    <span className="font-mono text-[var(--color-accent)]">{formatCurrency(total)}</span>
                  </div>
                </div>
                <button onClick={onClose}
                  className="w-full py-4 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-lg font-bold hover:brightness-110 transition-all active:scale-95">
                  ✓ Siparişi Kaydet
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Menü başlık */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex-shrink-0">
              <button onClick={() => setView('order')}
                className="p-3 rounded-2xl text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] transition-colors">
                <ChevronLeft size={22} />
              </button>
              <h2 className="font-display font-bold text-[var(--color-text)] text-xl">Ürün Seç</h2>
              <div className="flex-1">
                <Input icon={<Search size={15} />} placeholder="Ürün ara..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>

            {/* Gövde: sol kategori listesi + sağ ürün grid */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sol: Kategori listesi — tümü görünür, kaydırmalı */}
              <div className="w-36 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto flex flex-col gap-0.5 p-2">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-xl text-sm font-body transition-all duration-150',
                      selectedCategory === cat.id
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                        : 'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
                    )}>
                    <span className="mr-1.5">{cat.icon}</span>
                    <span className="leading-snug">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Sağ: Ürün grid — 2 sütun, tablet dostu */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredItems.map(item => (
                    <button key={item.id} onClick={() => handleAddItem(item)}
                      disabled={isLoading}
                      className={cn(
                        'flex flex-col p-4 rounded-2xl text-left transition-all duration-150 min-h-[90px]',
                        'bg-[var(--color-surface)] border-2 border-[var(--color-border)]',
                        'hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface2)]',
                        'active:scale-95 active:border-[var(--color-accent)]',
                        'disabled:opacity-40 disabled:cursor-not-allowed'
                      )}>
                      <p className="text-sm font-semibold text-[var(--color-text)] font-body leading-snug mb-1.5 line-clamp-2">{item.name}</p>
                      <p className="text-base font-bold text-[var(--color-accent)] font-mono mt-auto">{formatCurrency(item.price)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
