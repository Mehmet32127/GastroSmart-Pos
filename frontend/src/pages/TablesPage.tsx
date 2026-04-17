import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  Search, RefreshCw, LayoutGrid, List, Plus, Edit2, Trash2,
  Settings, ChevronDown, Tag, ZoomIn, ZoomOut,
} from 'lucide-react'
import { TableCard } from '@/components/tables/TableCard'
import { OrderPanel } from '@/components/orders/OrderPanel'
import { Spinner, EmptyState } from '@/components/ui/common'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { tablesApi } from '@/api/tables'
import { useTableStore } from '@/store/tableStore'
import { useOrderStore } from '@/store/orderStore'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/format'
import type { Table, Order } from '@/types'
import toast from 'react-hot-toast'

const STATUS_FILTERS = [
  { value: 'all',       label: 'Tümü'    },
  { value: 'available', label: 'Boş'     },
  { value: 'occupied',  label: 'Dolu'    },
  { value: 'reserved',  label: 'Rezerve' },
]

type CardSize = 'sm' | 'md' | 'lg'

const GRID_COLS: Record<CardSize, string> = {
  sm: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
  md: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
}

const CARD_HEIGHT: Record<CardSize, string> = {
  sm: 'h-[90px]',
  md: 'h-[130px]',
  lg: 'h-[170px]',
}

const loadCustomSections = (): string[] => {
  try { return JSON.parse(localStorage.getItem('gastro_sections') || '[]') } catch { return [] }
}

export const TablesPage: React.FC = () => {
  const { tables, isLoading, searchQuery, setTables, setLoading, setSearchQuery, selectedTable, setSelectedTable } = useTableStore()
  const { setCurrentOrder } = useOrderStore()
  const { status: socketStatus } = useSocket()
  const { user } = useAuthStore()
  const previousStatusRef = useRef<string>('disconnected')
  const gearRef = useRef<HTMLDivElement>(null)

  const [sectionFilter, setSectionFilter] = useState('Tümü')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode]   = useState<'grid' | 'list'>('grid')
  const [cardSize, setCardSize]   = useState<CardSize>('md')
  const [refreshing, setRefreshing] = useState(false)
  const [orderPanelOpen, setOrderPanelOpen] = useState(false)
  const [gearOpen, setGearOpen] = useState(false)

  // Masa yönetimi
  const [mgmtMode, setMgmtMode] = useState(false)
  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [editTable, setEditTable] = useState<Table | null>(null)
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null)
  const [tableForm, setTableForm] = useState({ number: '', name: '', capacity: '4', section: '' })
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  // Kategori yönetimi
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [customSections, setCustomSections] = useState<string[]>(loadCustomSections)
  const [newSectionInput, setNewSectionInput] = useState('')
  const [renamingSection, setRenamingSection] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingSection, setDeletingSection] = useState<string | null>(null)

  // Tüm bölümler (custom + tablolardan türetilen)
  const tableSections = Array.from(new Set(tables.map(t => t.section).filter(Boolean) as string[]))
  const allSections   = Array.from(new Set([...customSections, ...tableSections])).sort()
  const sections      = ['Tümü', ...allSections]

  const saveCustomSections = (secs: string[]) => {
    setCustomSections(secs)
    localStorage.setItem('gastro_sections', JSON.stringify(secs))
  }

  const loadTables = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await tablesApi.getAll()
      setTables(data.data || [])
    } catch {
      toast.error('Masalar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [setLoading, setTables])

  useEffect(() => { loadTables() }, [loadTables])
  useEffect(() => {
    const interval = setInterval(loadTables, 30000)
    return () => clearInterval(interval)
  }, [loadTables])
  useEffect(() => {
    if (socketStatus === 'connected' && previousStatusRef.current === 'disconnected') {
      loadTables()
      toast.success('Bağlantı geri geldi! Masalar yenilendi.')
    }
    previousStatusRef.current = socketStatus
  }, [socketStatus, loadTables])

  // Gear dışına tıklayınca kapat
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredTables = tables.filter(t => {
    const matchSection = sectionFilter === 'Tümü' || t.section === sectionFilter
    const matchStatus  = statusFilter === 'all' || t.status === statusFilter
    const matchSearch  = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || String(t.number).includes(searchQuery)
    return matchSection && matchStatus && matchSearch
  })

  const statusCounts = tables.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleTableClick = (table: Table) => {
    setSelectedTable(table)
    setCurrentOrder(null)
    setOrderPanelOpen(true)
  }
  const handleClosePanel = () => {
    setOrderPanelOpen(false)
    setSelectedTable(null)
    loadTables()
  }
  const handlePayment = (_order: Order) => {
    handleClosePanel()
    toast.success('Sipariş kaydedildi! Ödeme için Siparişler ekranını kullanın.')
  }
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTables()
    setRefreshing(false)
  }

  // Akıllı modal: kategori seçiliyse adı ve bölümü otomatik doldur
  const openTableModal = (table?: Table) => {
    setEditTable(table ?? null)
    if (!table && sectionFilter !== 'Tümü') {
      const maxNum      = tables.length > 0 ? Math.max(...tables.map(t => t.number)) : 0
      const sectionCnt  = tables.filter(t => t.section === sectionFilter).length + 1
      setTableForm({
        number:   String(maxNum + 1),
        name:     `${sectionFilter} ${sectionCnt}`,
        capacity: '4',
        section:  sectionFilter,
      })
    } else {
      setTableForm({
        number:   String(table?.number   ?? ''),
        name:     table?.name            ?? '',
        capacity: String(table?.capacity ?? '4'),
        section:  table?.section         ?? '',
      })
    }
    setTableModalOpen(true)
  }

  const handleSaveTable = async () => {
    const payload = {
      number:   parseInt(tableForm.number),
      name:     tableForm.name.trim(),
      capacity: parseInt(tableForm.capacity),
      section:  tableForm.section.trim() || undefined,
    }
    if (!payload.name || isNaN(payload.number) || payload.number < 1) {
      toast.error('Masa no ve isim zorunludur')
      return
    }
    try {
      if (editTable) {
        await tablesApi.update(editTable.id, payload)
        toast.success('Masa güncellendi')
      } else {
        await tablesApi.create(payload)
        toast.success('Masa eklendi')
      }
      setTableModalOpen(false)
      loadTables()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg || 'İşlem başarısız')
    }
  }

  const handleDeleteTable = async () => {
    if (!deleteTableId) return
    try {
      await tablesApi.delete(deleteTableId)
      toast.success('Masa silindi')
      setDeleteTableId(null)
      loadTables()
    } catch {
      toast.error('Silinemedi — açık siparişi olabilir')
    }
  }

  // Kategori: ekle
  const handleAddSection = () => {
    const name = newSectionInput.trim()
    if (!name) return
    if (allSections.map(s => s.toLowerCase()).includes(name.toLowerCase())) {
      toast.error('Bu kategori zaten var')
      return
    }
    saveCustomSections([...customSections, name])
    setNewSectionInput('')
  }

  // Kategori: yeniden adlandır
  const handleRenameSection = async (oldName: string) => {
    const newName = renameValue.trim()
    if (!newName || newName === oldName) { setRenamingSection(null); return }
    const toUpdate = tables.filter(t => t.section === oldName)
    try {
      await Promise.all(toUpdate.map(t => tablesApi.update(t.id, { section: newName })))
      if (customSections.includes(oldName)) {
        saveCustomSections(customSections.map(s => s === oldName ? newName : s))
      } else {
        // tablolardan türetilen, sadece adı ekle
        saveCustomSections([...customSections.filter(s => s !== oldName), newName])
      }
      if (sectionFilter === oldName) setSectionFilter(newName)
      setRenamingSection(null)
      loadTables()
      toast.success('Kategori yeniden adlandırıldı')
    } catch {
      toast.error('Yeniden adlandırma başarısız')
    }
  }

  // Kategori: sil
  const handleDeleteSection = async (name: string) => {
    const toUpdate = tables.filter(t => t.section === name)
    try {
      await Promise.all(toUpdate.map(t => tablesApi.update(t.id, { section: '' })))
      saveCustomSections(customSections.filter(s => s !== name))
      if (sectionFilter === name) setSectionFilter('Tümü')
      setDeletingSection(null)
      loadTables()
      toast.success('Kategori silindi')
    } catch {
      toast.error('Silme başarısız')
    }
  }

  const isSmartMode = !editTable && sectionFilter !== 'Tümü'

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex-1">
            <h1 className="text-lg font-bold font-display text-[var(--color-text)]">Masa Planı</h1>
            <p className="text-xs text-[var(--color-text-muted)] font-body">
              {tables.length} masa · {statusCounts['occupied'] || 0} dolu · {statusCounts['available'] || 0} boş
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Arama */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Masa ara..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/40 font-body w-36" />
            </div>

            {/* Kart boyutu */}
            <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
              {(['sm', 'md', 'lg'] as CardSize[]).map(size => (
                <button key={size} onClick={() => setCardSize(size)}
                  className={cn('px-3 py-1.5 text-xs font-bold transition-colors',
                    cardSize === size
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}>
                  {size === 'sm' ? 'S' : size === 'md' ? 'M' : 'L'}
                </button>
              ))}
            </div>

            {/* Grid / Liste */}
            <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
              {(['grid', 'list'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={cn('p-1.5 transition-colors',
                    viewMode === mode
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                      : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]')}>
                  {mode === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
                </button>
              ))}
            </div>

            {/* Yenile */}
            <button onClick={handleRefresh}
              className="p-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            </button>

            {/* Gear dropdown */}
            {canManage && (
              <div className="relative" ref={gearRef}>
                <button onClick={() => setGearOpen(o => !o)}
                  className={cn(
                    'flex items-center gap-1 pl-2 pr-1.5 py-1.5 rounded-xl border transition-colors text-xs font-body',
                    (mgmtMode || gearOpen)
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                      : 'bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  )}>
                  <Settings size={14} />
                  <ChevronDown size={10} className={cn('transition-transform', gearOpen && 'rotate-180')} />
                </button>

                {gearOpen && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-card-hover z-30 overflow-hidden py-1">
                    <button
                      onClick={() => { setMgmtMode(m => !m); setGearOpen(false) }}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-left transition-colors hover:bg-[var(--color-surface2)]',
                        mgmtMode ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'
                      )}>
                      <Edit2 size={14} />
                      {mgmtMode ? '✓ Yönetim Modu Açık' : 'Yönetim Modunu Aç'}
                    </button>
                    <div className="h-px bg-[var(--color-border)] mx-3" />
                    <button
                      onClick={() => { setCatModalOpen(true); setGearOpen(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-body text-left text-[var(--color-text)] hover:bg-[var(--color-surface2)] transition-colors">
                      <Tag size={14} />
                      Kategori Yönetimi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filtre çubuğu */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
          {sections.map(sec => (
            <button key={sec} onClick={() => setSectionFilter(sec)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium font-body whitespace-nowrap transition-all',
                sectionFilter === sec
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                  : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              )}>
              {sec}
            </button>
          ))}

          <div className="w-px h-5 bg-[var(--color-border)] mx-1 flex-shrink-0" />

          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={cn(
                'flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium font-body whitespace-nowrap transition-all border',
                statusFilter === f.value
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)] border-transparent'
              )}>
              {f.label}
              {f.value !== 'all' && <span className="ml-1 opacity-60">{statusCounts[f.value] || 0}</span>}
            </button>
          ))}
        </div>

        {/* Masalar */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
          ) : filteredTables.length === 0 && !mgmtMode ? (
            <EmptyState icon={<LayoutGrid size={24} />} title="Masa bulunamadı" description="Bu filtreyle eşleşen masa yok" />
          ) : viewMode === 'grid' ? (
            <div className={cn('grid gap-3', GRID_COLS[cardSize])}>
              {mgmtMode && canManage && (
                <button onClick={() => openTableModal()}
                  className={cn(CARD_HEIGHT[cardSize], 'w-full flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-accent)]/30 text-[var(--color-accent)] hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-accent)]/5 transition-all')}>
                  <Plus size={20} />
                  <span className="text-xs mt-1 font-body">
                    {sectionFilter !== 'Tümü' ? sectionFilter : 'Masa Ekle'}
                  </span>
                </button>
              )}
              {filteredTables.map(table => (
                <div key={table.id} className={cn('relative group', CARD_HEIGHT[cardSize])}>
                  <TableCard table={table} onClick={mgmtMode ? () => {} : handleTableClick}
                    isSelected={selectedTable?.id === table.id} cardSize={cardSize} />
                  {mgmtMode && canManage && (
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openTableModal(table)}
                        className="p-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors shadow-sm">
                        <Edit2 size={11} />
                      </button>
                      <button onClick={() => setDeleteTableId(table.id)}
                        className="p-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-red-400 transition-colors shadow-sm">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTables.map(table => (
                <button key={table.id} onClick={() => handleTableClick(table)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors',
                    'bg-[var(--color-surface)] hover:bg-[var(--color-surface2)]',
                    selectedTable?.id === table.id ? 'border-[var(--color-accent)]/40' : 'border-[var(--color-border)]'
                  )}>
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-surface2)] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold font-display text-[var(--color-text)]">{table.number}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text)] font-body">{table.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] font-body">
                      {table.capacity} kişi{table.section ? ` · ${table.section}` : ''}
                    </p>
                  </div>
                  <span className={cn(
                    'text-xs px-2.5 py-1 rounded-lg font-body font-medium',
                    table.status === 'available' ? 'bg-green-500/15 text-green-400' :
                    table.status === 'occupied'  ? 'bg-red-500/15  text-red-400'   :
                    table.status === 'reserved'  ? 'bg-amber-500/15 text-amber-400' :
                                                   'bg-blue-500/15  text-blue-400'
                  )}>
                    {table.status === 'available' ? 'Boş' : table.status === 'occupied' ? 'Dolu' : table.status === 'reserved' ? 'Rezerve' : 'Temizleniyor'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {orderPanelOpen && selectedTable && (
        <OrderPanel table={selectedTable} onClose={handleClosePanel} />
      )}

      {/* ── Masa Ekle / Düzenle Modal ─────────────────────────────────────────── */}
      <Modal isOpen={tableModalOpen} onClose={() => setTableModalOpen(false)}
        title={editTable ? 'Masa Düzenle' : 'Yeni Masa'} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setTableModalOpen(false)}>İptal</Button>
          <Button onClick={handleSaveTable}>{editTable ? 'Güncelle' : 'Ekle'}</Button>
        </>}>
        <div className="space-y-3">
          {/* Akıllı mod bilgi bandı */}
          {isSmartMode && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
              <Tag size={12} className="text-[var(--color-accent)] flex-shrink-0" />
              <p className="text-xs text-[var(--color-accent)] font-body">
                <span className="font-semibold">{sectionFilter}</span> kategorisi ·{' '}
                Ad otomatik: <span className="font-semibold">{tableForm.name}</span>
              </p>
            </div>
          )}

          {/* No + Kapasite — her zaman göster */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Masa No *</label>
              <input type="number" min="1" value={tableForm.number}
                onChange={e => setTableForm(f => ({ ...f, number: e.target.value }))}
                className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Kapasite *</label>
              <input type="number" min="1" value={tableForm.capacity}
                onChange={e => setTableForm(f => ({ ...f, capacity: e.target.value }))}
                className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50" />
            </div>
          </div>

          {/* Ad + Bölüm — sadece Tümü sekmesinde veya düzenleme modunda */}
          {(!isSmartMode) && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Masa Adı *</label>
                <input value={tableForm.name}
                  onChange={e => setTableForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ör. Masa 1 veya Bahçe 3"
                  className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-text-muted)] font-body">Kategori (isteğe bağlı)</label>
                <input value={tableForm.section}
                  onChange={e => setTableForm(f => ({ ...f, section: e.target.value }))}
                  list="section-suggestions"
                  placeholder="ör. Salon, Teras, VIP"
                  className="w-full bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50" />
                <datalist id="section-suggestions">
                  {allSections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Kategori Yönetimi Modal ───────────────────────────────────────────── */}
      <Modal isOpen={catModalOpen} onClose={() => { setCatModalOpen(false); setRenamingSection(null) }}
        title="Kategori Yönetimi" size="sm"
        footer={<Button variant="secondary" onClick={() => setCatModalOpen(false)}>Kapat</Button>}>
        <div className="space-y-4">
          {/* Yeni kategori ekle */}
          <div className="flex gap-2">
            <input
              value={newSectionInput}
              onChange={e => setNewSectionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSection()}
              placeholder="Yeni kategori adı (ör. Bahçe)"
              className="flex-1 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-body text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]/50 placeholder-[var(--color-text-muted)]/50"
            />
            <Button size="sm" icon={<Plus size={13} />} onClick={handleAddSection}>Ekle</Button>
          </div>

          {/* Mevcut kategoriler */}
          {allSections.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4 font-body">Henüz kategori yok</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {allSections.map(sec => {
                const tableCount = tables.filter(t => t.section === sec).length
                return (
                  <div key={sec} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)]">
                    {renamingSection === sec ? (
                      <input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameSection(sec); if (e.key === 'Escape') setRenamingSection(null) }}
                        autoFocus
                        className="flex-1 bg-transparent text-sm font-body text-[var(--color-text)] focus:outline-none border-b border-[var(--color-accent)]/50"
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] font-body">{sec}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] font-body">{tableCount} masa</p>
                      </div>
                    )}

                    {renamingSection === sec ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleRenameSection(sec)}
                          className="px-2 py-1 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-body hover:bg-[var(--color-accent)]/25 transition-colors">
                          Kaydet
                        </button>
                        <button onClick={() => setRenamingSection(null)}
                          className="px-2 py-1 rounded-lg bg-[var(--color-surface)] text-[var(--color-text-muted)] text-xs font-body hover:bg-[var(--color-border)] transition-colors">
                          İptal
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button onClick={() => { setRenamingSection(sec); setRenameValue(sec) }}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setDeletingSection(sec)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteTableId} onConfirm={handleDeleteTable}
        onCancel={() => setDeleteTableId(null)} title="Masa Sil"
        message="Bu masayı silmek istediğinizden emin misiniz? Açık siparişi olan masa silinemez."
        confirmText="Sil" danger />

      <ConfirmDialog
        isOpen={!!deletingSection}
        onConfirm={() => deletingSection && handleDeleteSection(deletingSection)}
        onCancel={() => setDeletingSection(null)}
        title="Kategori Sil"
        message={`"${deletingSection}" kategorisi silinecek. Bu kategorideki masaların kategorisi temizlenecek (masalar silinmez).`}
        confirmText="Sil" danger />
    </>
  )
}
