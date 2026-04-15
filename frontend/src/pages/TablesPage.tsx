import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Search, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { TableCard } from '@/components/tables/TableCard'
import { OrderPanel } from '@/components/orders/OrderPanel'
import { Spinner, EmptyState } from '@/components/ui/common'
import { tablesApi } from '@/api/tables'
import { useTableStore } from '@/store/tableStore'
import { useOrderStore } from '@/store/orderStore'
import { useSocket } from '@/hooks/useSocket'
import { cn } from '@/utils/format'
import type { Table, Order } from '@/types'
import toast from 'react-hot-toast'

const STATUS_FILTERS = [
  { value: 'all',       label: 'Tümü'    },
  { value: 'available', label: 'Boş'     },
  { value: 'occupied',  label: 'Dolu'    },
  { value: 'reserved',  label: 'Rezerve' },
]

export const TablesPage: React.FC = () => {
  const { tables, isLoading, searchQuery, setTables, setLoading, setSearchQuery, selectedTable, setSelectedTable } = useTableStore()
  const { setCurrentOrder } = useOrderStore()
  const { status: socketStatus } = useSocket()
  const previousStatusRef = useRef<string>('disconnected')

  const [sectionFilter, setSectionFilter] = useState('Tümü')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [refreshing, setRefreshing] = useState(false)
  const [orderPanelOpen, setOrderPanelOpen] = useState(false)

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

  // Socket reconnect'ten sonra masaları yenile
  useEffect(() => {
    if (socketStatus === 'connected' && previousStatusRef.current === 'disconnected') {
      console.log('[TABLES] Socket reconnected, refreshing tables...')
      loadTables()
      toast.success('Bağlantı geri geldi! Masalar yenilendi.')
    }
    previousStatusRef.current = socketStatus
  }, [socketStatus, loadTables])

  // Benzersiz bölümler — otomatik oluşur
  const sections = ['Tümü', ...Array.from(new Set(tables.map(t => t.section).filter(Boolean) as string[]))]

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

  // Masalar ekranında ödeme yok — ödeme siparişler ekranından
  const handlePayment = (_order: Order) => {
    handleClosePanel()
    toast.success('Sipariş kaydedildi! Ödeme için Siparişler ekranını kullanın.')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTables()
    setRefreshing(false)
  }

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
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Masa ara..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)]/50 focus:outline-none focus:border-[var(--color-accent)]/40 font-body w-36" />
            </div>
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
            <button onClick={handleRefresh}
              className="p-1.5 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Filtre çubuğu: Bölüm + Durum */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
          {/* Bölüm filtreleri */}
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

          {/* Durum filtreleri */}
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
          ) : filteredTables.length === 0 ? (
            <EmptyState icon={<LayoutGrid size={24} />} title="Masa bulunamadı" description="Bu filtreyle eşleşen masa yok" />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredTables.map(table => (
                <TableCard key={table.id} table={table} onClick={handleTableClick}
                  isSelected={selectedTable?.id === table.id} />
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
    </>
  )
}
