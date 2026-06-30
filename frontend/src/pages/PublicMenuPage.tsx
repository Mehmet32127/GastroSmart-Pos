import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Plus, Minus, ShoppingBag, Check, ArrowLeft, Utensils } from 'lucide-react'
import { publicApi } from '@/api/public'
import type { PublicMenu } from '@/api/public'
import { formatCurrency } from '@/utils/format'
import { menuImageUrl } from '@/utils/image'

interface CartLine { id: string; name: string; price: number; qty: number; note?: string }

export const PublicMenuPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const masaParam = searchParams.get('masa')

  const [menu, setMenu] = useState<PublicMenu | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [tableNumber, setTableNumber] = useState(masaParam ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [orderError, setOrderError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    publicApi.getMenu(slug)
      .then(({ data }) => {
        if (!active) return
        setMenu(data.data)
        setActiveCat(data.data.categories[0]?.id ?? null)
      })
      .catch(() => active && setLoadError('Menü yüklenemedi. QR kodu veya restoran kodu hatalı olabilir.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [slug])

  const items = useMemo(
    () => (menu?.items ?? []).filter(i => !activeCat || i.categoryId === activeCat),
    [menu, activeCat],
  )
  const cartLines = Object.values(cart)
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0)
  const cartTotal = cartLines.reduce((s, l) => s + l.price * l.qty, 0)

  const addToCart = (id: string, name: string, price: number) =>
    setCart(c => ({ ...c, [id]: { id, name, price, qty: (c[id]?.qty ?? 0) + 1, note: c[id]?.note } }))
  const decFromCart = (id: string) =>
    setCart(c => {
      const cur = c[id]
      if (!cur) return c
      if (cur.qty <= 1) { const { [id]: _drop, ...rest } = c; return rest }
      return { ...c, [id]: { ...cur, qty: cur.qty - 1 } }
    })

  const submitOrder = async () => {
    const num = parseInt(tableNumber, 10)
    if (Number.isNaN(num) || num < 1) { setOrderError('Lütfen masa numaranızı girin'); return }
    if (cartLines.length === 0) return
    setSubmitting(true); setOrderError(null)
    try {
      await publicApi.createOrder(slug, {
        tableNumber: num,
        items: cartLines.map(l => ({ menuItemId: l.id, quantity: l.qty, note: l.note })),
      })
      setSuccess(true)
      setCart({})
      setCartOpen(false)
    } catch (e: any) {
      setOrderError(e?.response?.data?.error || 'Sipariş gönderilemedi, tekrar deneyin')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Durum ekranları ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="animate-pulse text-[var(--color-text-muted)] font-body text-sm">Menü yükleniyor…</div>
      </div>
    )
  }
  if (loadError || !menu) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Utensils size={32} className="mx-auto text-[var(--color-text-muted)] mb-3" />
          <p className="text-[var(--color-text)] font-body">{loadError || 'Menü bulunamadı'}</p>
        </div>
      </div>
    )
  }
  if (success) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold font-display text-[var(--color-text)] mb-2">Siparişiniz alındı!</h2>
          <p className="text-sm text-[var(--color-text-muted)] font-body mb-6">
            Garson siparişinizi onayladığında hazırlanmaya başlayacak. Afiyet olsun.
          </p>
          <button onClick={() => setSuccess(false)}
            className="px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-sm font-bold font-display">
            Yeni Sipariş Ver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-bold font-display text-[var(--color-text)]">{menu.restaurant}</h1>
          <p className="text-xs text-[var(--color-text-muted)] font-body">
            {masaParam ? `Masa ${masaParam}` : 'Dijital Menü'} · QR Sipariş
          </p>
        </div>
      </header>

      {/* Kategori sekmeleri */}
      <div className="sticky top-[60px] z-10 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
        <div className="max-w-md mx-auto flex gap-2 px-4 py-2.5 overflow-x-auto">
          {menu.categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-medium font-body whitespace-nowrap transition-colors ${
                activeCat === c.id
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                  : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)]'
              }`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ürünler */}
      <main className="max-w-md mx-auto px-4 py-3 space-y-2.5">
        {items.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] font-body py-10">Bu kategoride ürün yok</p>
        ) : items.map(it => {
          const qty = cart[it.id]?.qty ?? 0
          return (
            <div key={it.id} className={`flex items-center gap-3 p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] ${it.soldOut ? 'opacity-50' : ''}`}>
              {it.hasImage && (
                <img src={menuImageUrl(slug, it.id, it.imgVersion)} alt={it.name} loading="lazy"
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-[var(--color-border)]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)] font-body">{it.name}</p>
                {it.description && <p className="text-xs text-[var(--color-text-muted)] font-body line-clamp-2 mt-0.5">{it.description}</p>}
                <p className="text-sm font-bold font-mono text-[var(--color-accent)] mt-1">{formatCurrency(it.price)}</p>
              </div>
              {it.soldOut ? (
                <span className="text-xs font-body text-red-400 flex-shrink-0">Tükendi</span>
              ) : qty > 0 ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => decFromCart(it.id)} className="w-8 h-8 rounded-lg bg-[var(--color-surface2)] text-[var(--color-text)] flex items-center justify-center"><Minus size={14} /></button>
                  <span className="w-5 text-center text-sm font-mono font-bold text-[var(--color-text)]">{qty}</span>
                  <button onClick={() => addToCart(it.id, it.name, it.price)} className="w-8 h-8 rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-text)] flex items-center justify-center"><Plus size={14} /></button>
                </div>
              ) : (
                <button onClick={() => addToCart(it.id, it.name, it.price)}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center hover:bg-[var(--color-accent)]/25 transition-colors"><Plus size={18} /></button>
              )}
            </div>
          )
        })}
      </main>

      {/* Sepet alt bar */}
      {cartCount > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md flex items-center justify-between px-5 py-3.5 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-text)] shadow-card-hover z-30">
          <span className="flex items-center gap-2 font-body font-semibold text-sm"><ShoppingBag size={16} /> Sepet · {cartCount} ürün</span>
          <span className="font-mono font-bold">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      {/* Sepet / sipariş paneli */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end" onClick={() => setCartOpen(false)}>
          <div className="w-full max-w-md mx-auto bg-[var(--color-surface)] rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setCartOpen(false)} className="p-1.5 text-[var(--color-text-muted)]"><ArrowLeft size={18} /></button>
              <h2 className="text-base font-bold font-display text-[var(--color-text)]">Siparişiniz</h2>
            </div>

            <div className="space-y-2 mb-4">
              {cartLines.map(l => (
                <div key={l.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[var(--color-text)] font-body flex-1 truncate">{l.qty}× {l.name}</span>
                  <span className="text-sm font-mono text-[var(--color-text-muted)]">{formatCurrency(l.price * l.qty)}</span>
                  <button onClick={() => decFromCart(l.id)} className="w-7 h-7 rounded-lg bg-[var(--color-surface2)] flex items-center justify-center text-[var(--color-text-muted)]"><Minus size={12} /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-between py-3 border-t border-[var(--color-border)] mb-4">
              <span className="font-body text-[var(--color-text-muted)]">Toplam</span>
              <span className="font-mono font-bold text-[var(--color-accent)] text-lg">{formatCurrency(cartTotal)}</span>
            </div>

            {/* Masa no (QR'da yoksa elle) */}
            <div className="mb-3">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Masa Numarası</label>
              <input
                inputMode="numeric" value={tableNumber}
                onChange={e => { setTableNumber(e.target.value.replace(/\D/g, '')); setOrderError(null) }}
                placeholder="Örn. 5" disabled={!!masaParam}
                className="w-full mt-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 disabled:opacity-60"
              />
            </div>

            {orderError && (
              <p className="text-xs text-red-400 font-body text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{orderError}</p>
            )}

            <button onClick={submitOrder} disabled={submitting}
              className="w-full py-3.5 rounded-2xl bg-[var(--color-accent)] text-[var(--color-accent-text)] text-sm font-bold font-display disabled:opacity-50">
              {submitting ? 'Gönderiliyor…' : `Sipariş Ver · ${formatCurrency(cartTotal)}`}
            </button>
            <p className="text-[11px] text-[var(--color-text-muted)] font-body text-center mt-2">
              Siparişiniz garson onayından sonra hazırlanır. Ödeme masada alınır.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
