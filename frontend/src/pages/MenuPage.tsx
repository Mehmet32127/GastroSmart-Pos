import React, { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Search, AlertTriangle, Package, ClipboardList } from 'lucide-react'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Badge, Card, Spinner, EmptyState } from '@/components/ui/common'
import { menuApi } from '@/api/menu'
import { formatCurrency, cn } from '@/utils/format'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { MenuItem, Category } from '@/types'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

// Boş string'i undefined'a çeviren önişlemci.
// z.coerce.number() boş string'i 0'a çevirir — bu istemediğimiz davranış
// (özellikle stoğu boş bırakmak "sınırsız" anlamına geliyor, 0 değil).
const emptyToUndefined = (val: unknown) => (val === '' || val === null ? undefined : val)

const itemSchema = z.object({
  name: z.string().min(1, 'Ürün adı gerekli'),
  categoryId: z.string().min(1, 'Kategori seçin'),
  price: z.coerce.number().min(0.01, 'Fiyat gerekli'),
  cost: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  tax: z.coerce.number().min(0).max(100).default(8),
  stock: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  unit: z.string().default('adet'),
  description: z.string().optional(),
  active: z.boolean().default(true),
})

type ItemForm = z.infer<typeof itemSchema>

export const MenuPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catName, setCatName] = useState('')
  const [catIcon, setCatIcon] = useState('🍽️')
  const [editItem, setEditItem] = useState<MenuItem | undefined>()
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null)
  const [stockModalItem, setStockModalItem] = useState<MenuItem | null>(null)
  const [stockAdjust, setStockAdjust] = useState('')
  const [stockCountOpen, setStockCountOpen] = useState(false)
  const [bulkStockMap, setBulkStockMap] = useState<Record<string, string>>({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const canManageStock = useAuthStore((s) => s.hasRole(['admin', 'manager']))

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { tax: 8, unit: 'adet', active: true },
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [c, i] = await Promise.all([menuApi.getCategories(), menuApi.getItems()])
      setCategories(c.data.data || [])
      setItems(i.data.data || [])
    } catch { toast.error('Menü yüklenemedi') }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const openItemModal = (item?: MenuItem) => {
    setEditItem(item)
    if (item) {
      reset({
        name:        item.name,
        categoryId:  item.categoryId,
        price:       item.price,
        cost:        item.cost ?? 0,
        tax:         item.tax  ?? 8,
        // Stok inputu: değer tanımlıysa gösterilir, null/undefined ise boş kalır.
        // Boş bırakılırsa stok takibi yapılmaz (sınırsız) — bu davranış formdaki
        // "Boş = sınırsız" hint'iyle uyumlu. Default 0 KOYMA: Düzenle'ye basıp
        // sadece fiyatı değiştirsen bile sınırsız stoklu ürünü 0'a düşürür.
        stock:       item.stock ?? undefined,
        unit:        item.unit ?? 'adet',
        description: item.description ?? '',
        active:      item.active,
      })
    } else {
      reset({ tax: 8, unit: 'adet', active: true })
    }
    setItemModalOpen(true)
  }

  const onSubmitItem = async (data: ItemForm) => {
    try {
      if (editItem) {
        await menuApi.updateItem(editItem.id, data)
        toast.success('Ürün güncellendi')
      } else {
        await menuApi.createItem(data)
        toast.success('Ürün eklendi')
      }
      setItemModalOpen(false)
      load()
    } catch { toast.error('İşlem başarısız') }
  }

  const handleDeleteItem = async () => {
    if (!deleteItemId) return
    try {
      await menuApi.deleteItem(deleteItemId)
      toast.success('Ürün silindi')
      setDeleteItemId(null)
      load()
    } catch { toast.error('Silinemedi') }
  }

  const handleCreateCategory = async () => {
    if (!catName.trim()) return
    try {
      await menuApi.createCategory({ name: catName.trim(), icon: catIcon })
      toast.success('Kategori eklendi')
      setCatModalOpen(false)
      setCatName('')
      setCatIcon('🍽️')
      load()
    } catch { toast.error('Kategori eklenemedi') }
  }

  const handleDeleteCategory = async () => {
    if (!deleteCatId) return
    try {
      await menuApi.deleteCategory(deleteCatId)
      toast.success('Kategori silindi')
      setDeleteCatId(null)
      if (selectedCategory === deleteCatId) setSelectedCategory('all')
      load()
    } catch { toast.error('Kategori silinemedi — içinde ürün olabilir') }
  }

  const handleStockUpdate = async (operation: 'set' | 'add' | 'subtract') => {
    if (!stockModalItem) return
    try {
      await menuApi.updateStock(stockModalItem.id, parseFloat(stockAdjust) || 0, operation)
      toast.success('Stok güncellendi')
      setStockModalItem(null)
      setStockAdjust('')
      load()
    } catch { toast.error('Stok güncellenemedi') }
  }

  const openStockCount = () => {
    // Mevcut stoğu input'lara doldur (boş bırakılırsa "değişmesin" anlamına gelir)
    const seed: Record<string, string> = {}
    items.forEach((it) => {
      seed[it.id] = it.stock !== undefined && it.stock !== null ? String(it.stock) : ''
    })
    setBulkStockMap(seed)
    setStockCountOpen(true)
  }

  const handleBulkStockSave = async () => {
    // Yalnızca değişen değerleri gönder. Boş input → null (sınırsız)
    const updates = items
      .map((it) => {
        const raw = bulkStockMap[it.id]
        if (raw === undefined) return null
        const trimmed = raw.trim()
        const newVal: number | null = trimmed === '' ? null : Math.max(0, parseFloat(trimmed) || 0)
        const oldVal = it.stock ?? null
        if (newVal === oldVal) return null
        return { id: it.id, quantity: newVal }
      })
      .filter((u): u is { id: string; quantity: number | null } => u !== null)

    if (updates.length === 0) {
      toast('Değişiklik yok', { icon: 'ℹ️' })
      return
    }

    setBulkSaving(true)
    try {
      const res = await menuApi.bulkUpdateStock(updates)
      const modified = res.data.data?.modified ?? updates.length
      toast.success(`${modified} ürünün stoğu güncellendi`)
      setStockCountOpen(false)
      setBulkStockMap({})
      load()
    } catch {
      toast.error('Toplu stok güncellenemedi')
    } finally {
      setBulkSaving(false)
    }
  }

  const filtered = items.filter((item) => {
    const matchCat = selectedCategory === 'all' || item.categoryId === selectedCategory
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  // Düşük stok eşiği: 5 adet — sabit ve sade
  const LOW_STOCK_THRESHOLD = 5
  const lowStock = items.filter(i => i.stock !== undefined && i.stock !== null && i.stock <= LOW_STOCK_THRESHOLD)
  const catOptions = [{ value: '', label: 'Kategori seçin' }, ...categories.map(c => ({ value: c.id, label: c.name }))]

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Sidebar: categories — mobilde gizli, üstte dropdown gösteriliyor */}
      <div className="hidden md:flex w-52 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="p-3 border-b border-[var(--color-border)]">
          <Button fullWidth size="sm" icon={<Plus size={14} />} onClick={() => setCatModalOpen(true)}>
            Kategori Ekle
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button onClick={() => setSelectedCategory('all')}
            className={cn('w-full text-left px-3 py-2 rounded-xl text-sm font-body transition-colors',
              selectedCategory === 'all'
                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
            )}>
            <span className="mr-2">📋</span> Tümü
            <span className="ml-1 text-xs opacity-60">({items.length})</span>
          </button>
          {categories.map((cat) => {
            const count = items.filter(i => i.categoryId === cat.id).length
            return (
              <div key={cat.id} className="group flex items-center gap-0.5">
                <button onClick={() => setSelectedCategory(cat.id)}
                  className={cn('flex-1 min-w-0 text-left px-3 py-2 rounded-xl text-sm font-body transition-colors flex items-center justify-between',
                    selectedCategory === cat.id
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
                  )}>
                  <span className="truncate"><span className="mr-2">{cat.icon}</span>{cat.name}</span>
                  <span className="text-xs opacity-60 ml-1 flex-shrink-0 group-hover:hidden">{count}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteCatId(cat.id) }}
                  className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Kategoriyi sil">
                  <Trash2 size={12} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="p-3 border-t border-[var(--color-border)]">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={12} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 font-body">Düşük Stok</span>
              </div>
              <div className="space-y-0.5">
                {lowStock.slice(0, 3).map(i => (
                  <p key={i.id} className="text-[10px] text-amber-400/80 font-body truncate">
                    {i.name}: {i.stock} {i.unit}
                  </p>
                ))}
                {lowStock.length > 3 && (
                  <p className="text-[10px] text-amber-400/60 font-body">+{lowStock.length - 3} daha</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:gap-3 md:px-4 md:py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          {/* Mobil kategori seçici — md+ ekranlarda gizli, sol sidebar görünür */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as string)}
            className="md:hidden bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-body text-[var(--color-text)] focus:outline-none"
          >
            <option value="all">📋 Tümü ({items.length})</option>
            {categories.map((cat) => {
              const count = items.filter(i => i.categoryId === cat.id).length
              return (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name} ({count})</option>
              )
            })}
          </select>

          <div className="relative flex-1 min-w-[120px] max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/40 font-body" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {canManageStock && (
              <Button
                size="sm"
                variant="secondary"
                icon={<ClipboardList size={14} />}
                onClick={openStockCount}
                disabled={items.length === 0}
                title="Tüm ürünlerin stoğunu tek ekrandan güncelle"
              >
                Stok Sayım
              </Button>
            )}
            <Button size="sm" icon={<Plus size={14} />} onClick={() => openItemModal()}>Ürün Ekle</Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Spinner size={32} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Package size={24} />}
              title={items.length === 0 ? 'Henüz ürün eklenmemiş' : 'Ürün bulunamadı'}
              description={
                items.length === 0
                  ? categories.length === 0
                    ? 'Önce sol panelden bir kategori, sonra ürün ekleyin'
                    : '"Ürün Ekle" ile başlayın'
                  : 'Bu filtreyle eşleşen ürün yok'
              }
              action={<Button size="sm" icon={<Plus size={14} />} onClick={() => openItemModal()}>Ürün Ekle</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((item) => (
                <Card key={item.id} hover className="!p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text)] font-body truncate">{item.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)] font-body">{item.categoryName}</p>
                    </div>
                    {!item.active && <Badge variant="muted">Pasif</Badge>}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold font-mono text-[var(--color-accent)]">
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] font-body">KDV %{item.tax}</span>
                  </div>

                  {canManageStock && (
                    (() => {
                      const hasStock = item.stock !== undefined && item.stock !== null
                      return (
                        <button
                          onClick={() => { setStockModalItem(item); setStockAdjust(hasStock ? String(item.stock) : '') }}
                          className={cn(
                            'w-full flex items-center justify-between px-2 py-1.5 rounded-lg mb-2 text-xs font-body transition-colors',
                            !hasStock
                              ? 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] border border-dashed border-[var(--color-border)]'
                              : item.stock! <= 0
                              ? 'bg-red-500/10 text-red-400'
                              : item.stock! <= LOW_STOCK_THRESHOLD
                              ? 'bg-amber-500/10 text-amber-400'
                              : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                          )}
                          title={hasStock ? 'Stoğu güncelle' : 'Stok belirle'}
                        >
                          <span className="flex items-center gap-1">
                            <Package size={10} />
                            {hasStock ? `Stok: ${item.stock} ${item.unit}` : 'Stok Belirle'}
                          </span>
                          {hasStock && item.stock! <= LOW_STOCK_THRESHOLD && item.stock! > 0 && (
                            <AlertTriangle size={10} />
                          )}
                        </button>
                      )
                    })()
                  )}

                  <div className="flex gap-1">
                    <button onClick={() => openItemModal(item)}
                      className="flex-1 py-1.5 rounded-lg bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] text-xs flex items-center justify-center gap-1 transition-colors font-body">
                      <Edit2 size={11} /> Düzenle
                    </button>
                    <button onClick={() => setDeleteItemId(item.id)}
                      className="p-1.5 rounded-lg bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Item Modal */}
      <Modal isOpen={itemModalOpen} onClose={() => setItemModalOpen(false)}
        title={editItem ? 'Ürün Düzenle' : 'Yeni Ürün'} size="md"
        footer={<>
          <Button variant="secondary" onClick={() => setItemModalOpen(false)}>İptal</Button>
          <Button onClick={handleSubmit(onSubmitItem)}>{editItem ? 'Güncelle' : 'Ekle'}</Button>
        </>}>
        <form className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ürün Adı *" error={errors.name?.message} {...register('name')} />
            <Select label="Kategori *" options={catOptions} error={errors.categoryId?.message} {...register('categoryId')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Fiyat ₺ *" type="number" step="0.01" error={errors.price?.message} {...register('price')} />
            <Input label="Maliyet ₺" type="number" step="0.01" {...register('cost')} />
            <Input label="KDV %" type="number" {...register('tax')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Stok" type="number" {...register('stock')} placeholder="Sınırsız" hint="Boş = stok takibi yok (sınırsız)" />
            <Input label="Birim" placeholder="adet" {...register('unit')} />
          </div>
          <Textarea label="Açıklama" {...register('description')} />
          <label className="flex items-center gap-2 text-sm font-body text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" {...register('active')} className="rounded" />
            Aktif
          </label>
        </form>
      </Modal>

      {/* Stock Modal */}
      <Modal isOpen={!!stockModalItem} onClose={() => { setStockModalItem(null); setStockAdjust('') }}
        title="Stok Güncelle" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => { setStockModalItem(null); setStockAdjust('') }}>İptal</Button>
          <Button onClick={() => handleStockUpdate('set')} disabled={!stockAdjust}>Kaydet</Button>
        </>}>
        {stockModalItem && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-muted)] font-body">
              <strong className="text-[var(--color-text)]">{stockModalItem.name}</strong>
              <span className="ml-2">· Mevcut: <strong className="text-[var(--color-accent)]">{stockModalItem.stock} {stockModalItem.unit}</strong></span>
            </p>
            <Input label="Yeni Miktar" type="number" step="0.1" min="0"
              value={stockAdjust} onChange={(e) => setStockAdjust(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && stockAdjust) handleStockUpdate('set') }} />
          </div>
        )}
      </Modal>

      {/* Stok Sayım Modal — toplu güncelleme */}
      <Modal
        isOpen={stockCountOpen}
        onClose={() => { if (!bulkSaving) { setStockCountOpen(false); setBulkStockMap({}) } }}
        title="Stok Sayım"
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => { setStockCountOpen(false); setBulkStockMap({}) }} disabled={bulkSaving}>
            İptal
          </Button>
          <Button onClick={handleBulkStockSave} disabled={bulkSaving}>
            {bulkSaving ? 'Kaydediliyor…' : 'Tümünü Kaydet'}
          </Button>
        </>}
      >
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-muted)] font-body">
            Yeni stoğu yaz; boş bırakırsan değişmez. Tamamen silmek için <strong>0</strong> gir, sınırsız yapmak için kelime "<strong>boş</strong>" yerine input'u temizle.
          </p>
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
            {categories.map((cat) => {
              const catItems = items.filter((i) => i.categoryId === cat.id)
              if (catItems.length === 0) return null
              return (
                <div key={cat.id} className="mb-3">
                  <p className="text-xs font-semibold text-[var(--color-accent)] font-body mb-1.5 sticky top-0 bg-[var(--color-surface)] py-1">
                    {cat.icon} {cat.name} <span className="text-[var(--color-text-muted)] opacity-60">({catItems.length})</span>
                  </p>
                  {catItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-[var(--color-surface2)]/50">
                      <span className="flex-1 text-xs text-[var(--color-text)] font-body truncate" title={it.name}>{it.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-body w-16 text-right">
                        Mevcut: <strong>{it.stock ?? '∞'}</strong>
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        inputMode="decimal"
                        placeholder="—"
                        value={bulkStockMap[it.id] ?? ''}
                        onChange={(e) => setBulkStockMap((m) => ({ ...m, [it.id]: e.target.value }))}
                        className="w-20 px-2 py-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/40 font-mono"
                      />
                      <span className="text-[10px] text-[var(--color-text-muted)] font-body w-10">{it.unit}</span>
                    </div>
                  ))}
                </div>
              )
            })}
            {/* Kategorisi olmayan ürünler */}
            {(() => {
              const orphans = items.filter((i) => !categories.find((c) => c.id === i.categoryId))
              if (orphans.length === 0) return null
              return (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] font-body mb-1.5">Kategorisiz</p>
                  {orphans.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 py-1 px-1">
                      <span className="flex-1 text-xs text-[var(--color-text)] font-body truncate">{it.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] w-16 text-right">Mevcut: <strong>{it.stock ?? '∞'}</strong></span>
                      <input
                        type="number" step="0.1" min="0" placeholder="—"
                        value={bulkStockMap[it.id] ?? ''}
                        onChange={(e) => setBulkStockMap((m) => ({ ...m, [it.id]: e.target.value }))}
                        className="w-20 px-2 py-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-lg text-xs font-mono"
                      />
                      <span className="text-[10px] text-[var(--color-text-muted)] w-10">{it.unit}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteItemId} onConfirm={handleDeleteItem}
        onCancel={() => setDeleteItemId(null)} title="Ürün Sil"
        message="Bu ürünü silmek istediğinizden emin misiniz?" confirmText="Sil" danger />

      <ConfirmDialog isOpen={!!deleteCatId} onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCatId(null)} title="Kategori Sil"
        message="Bu kategoriyi silmek istediğinizden emin misiniz? İçindeki ürünler kategorisiz kalır." confirmText="Sil" danger />

      {/* Kategori Modal */}
      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)}
        title="Yeni Kategori" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setCatModalOpen(false)}>İptal</Button>
          <Button onClick={handleCreateCategory} disabled={!catName.trim()}>Ekle</Button>
        </>}>
        <div className="space-y-3">
          <Input label="Kategori Adı *" value={catName} onChange={e => setCatName(e.target.value)}
            placeholder="ör. Başlangıçlar" />
          <Input label="Emoji / İkon" value={catIcon} onChange={e => setCatIcon(e.target.value)}
            placeholder="🍽️" />
        </div>
      </Modal>
    </div>
  )
}
