import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Edit2, Trash2, Search, Package, ImagePlus, X, Image as ImageIcon } from 'lucide-react'
import { fileToResizedDataUrl, menuImageUrl } from '@/utils/image'
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
  unit: z.string().default('adet'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
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
  const tenantSlug = useAuthStore((s) => s.user?.tenantSlug ?? '')

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { tax: 8, unit: 'adet', active: true },
  })

  // Ürün görseli — dosya seçilince tarayıcıda küçültülüp base64 olarak forma yazılır.
  // imageTouched: kullanıcı görseli DEĞİŞTİRDİ mi (yeni yükledi/kaldırdı). Değiştirmediyse
  // PUT'a imageUrl GÖNDERİLMEZ → backend mevcut görseli korur (base64'ü boşuna taşımayız).
  const imageFileRef = useRef<HTMLInputElement>(null)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageTouched, setImageTouched] = useState(false)
  const newImage = watch('imageUrl')   // yeni yüklenen base64 (sadece bu oturumda)

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Lütfen bir görsel dosyası seçin'); return }
    setImageProcessing(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      setValue('imageUrl', dataUrl, { shouldDirty: true })
      setImageTouched(true)
    } catch {
      toast.error('Görsel işlenemedi')
    } finally {
      setImageProcessing(false)
      if (imageFileRef.current) imageFileRef.current.value = ''
    }
  }

  const removeImage = () => { setValue('imageUrl', '', { shouldDirty: true }); setImageTouched(true) }

  // Önizlemede gösterilecek görsel: yeni yüklendiyse base64, yoksa mevcut görselin URL'i
  const existingImg = editItem?.hasImage && tenantSlug ? menuImageUrl(tenantSlug, editItem.id, editItem.imgVersion) : null
  const previewSrc = imageTouched ? (newImage || null) : existingImg

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
    setImageTouched(false)
    if (item) {
      reset({
        name:        item.name,
        categoryId:  item.categoryId,
        price:       item.price,
        cost:        item.cost ?? 0,
        tax:         item.tax  ?? 8,
        unit:        item.unit ?? 'adet',
        description: item.description ?? '',
        imageUrl:    '',   // mevcut görsel base64 olarak yüklenmez; URL'den önizlenir
        active:      item.active,
      })
    } else {
      reset({ tax: 8, unit: 'adet', active: true, imageUrl: '' })
    }
    setItemModalOpen(true)
  }

  const onSubmitItem = async (data: ItemForm) => {
    // Görsel değiştirilmediyse imageUrl gönderme → backend mevcut görseli korur
    const payload = { ...data }
    if (editItem && !imageTouched) delete payload.imageUrl
    try {
      if (editItem) {
        await menuApi.updateItem(editItem.id, payload)
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

  const filtered = items.filter((item) => {
    const matchCat = selectedCategory === 'all' || item.categoryId === selectedCategory
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCat && matchSearch
  })

  const catOptions = [{ value: '', label: 'Kategori seçin' }, ...categories.map(c => ({ value: c.id, label: c.name }))]

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Sidebar: categories — sadece desktop (lg+). Tablet ve mobilde dropdown kullanılır. */}
      <div className="hidden lg:flex w-52 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
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
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:gap-3 md:px-4 md:py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          {/* Kategori seçici — lg altı (mobil+tablet). lg+'ta sol sidebar var. */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as string)}
            className="lg:hidden bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-xs font-body text-[var(--color-text)] focus:outline-none"
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
                  {item.hasImage && tenantSlug && (
                    <div className="w-full h-24 -mx-3 -mt-3 mb-2.5 overflow-hidden rounded-t-2xl" style={{ width: 'calc(100% + 1.5rem)' }}>
                      <img src={menuImageUrl(tenantSlug, item.id, item.imgVersion)} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
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

                  {/* Kâr marjı — maliyet girilmişse fiyat-maliyet farkı + yüzde */}
                  {item.cost != null && item.cost > 0 && item.price > 0 && (
                    <div className="flex items-center justify-between mb-2 text-xs">
                      <span className="text-[var(--color-text-muted)] font-body">Maliyet {formatCurrency(item.cost)}</span>
                      <span className="font-mono text-green-400">
                        +{formatCurrency(item.price - item.cost)}
                        <span className="text-[var(--color-text-muted)]"> · %{(((item.price - item.cost) / item.price) * 100).toFixed(0)}</span>
                      </span>
                    </div>
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
          <Input label="Birim" placeholder="adet" {...register('unit')} />
          <Textarea label="Açıklama" {...register('description')} />

          {/* Ürün görseli — tarayıcıda küçültülüp base64 olarak saklanır */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-muted)] font-body">Ürün Görseli</label>
            <input type="hidden" {...register('imageUrl')} />
            <input ref={imageFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImagePick} />
            {previewSrc ? (
              <div className="relative w-full h-36 rounded-xl overflow-hidden border border-[var(--color-border)] group">
                <img src={previewSrc} alt="Önizleme" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => imageFileRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-[var(--color-surface)]/90 text-[var(--color-text)] text-xs font-body flex items-center gap-1">
                    <ImagePlus size={13} /> Değiştir
                  </button>
                  <button type="button" onClick={removeImage}
                    className="px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-xs font-body flex items-center gap-1">
                    <X size={13} /> Kaldır
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => imageFileRef.current?.click()} disabled={imageProcessing}
                className="w-full h-36 rounded-xl border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-1.5 text-[var(--color-text-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-accent)] transition-colors disabled:opacity-50">
                {imageProcessing ? <Spinner size={20} /> : <ImageIcon size={22} />}
                <span className="text-xs font-body">{imageProcessing ? 'İşleniyor...' : 'Görsel ekle (otomatik küçültülür)'}</span>
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm font-body text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" {...register('active')} className="rounded" />
            Aktif
          </label>
        </form>
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
