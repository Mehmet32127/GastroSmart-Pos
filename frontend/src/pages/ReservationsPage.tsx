import React, { useEffect, useState, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, Users, DollarSign, Trash2, Edit2, Search, X } from 'lucide-react'
import { ReservationModal } from '@/components/reservations/ReservationModal'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/common'
import { Spinner, EmptyState } from '@/components/ui/common'
import { reservationsApi } from '@/api/reservations'
import { cn, formatCurrency } from '@/utils/format'
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Reservation, ReservationStatus } from '@/types'
import toast from 'react-hot-toast'

const STATUS_MAP: Record<ReservationStatus, { label: string; variant: 'warning' | 'success' | 'danger' | 'muted' }> = {
  pending:   { label: 'Bekliyor',  variant: 'warning' },
  confirmed: { label: 'Onaylandı', variant: 'success' },
  seated:    { label: 'Masada',    variant: 'success' },
  cancelled: { label: 'İptal',     variant: 'danger' },
  completed: { label: 'Geçmiş',    variant: 'muted' },
}

export const ReservationsPage: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editReservation, setEditReservation] = useState<Reservation | undefined>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>('all')
  const [codeQuery, setCodeQuery] = useState('')
  const [codeSearchResult, setCodeSearchResult] = useState<Reservation | null>(null)
  const [codeSearching, setCodeSearching] = useState(false)

  const loadReservations = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await reservationsApi.getAll({
        date: format(selectedDate, 'yyyy-MM-dd'),
      })
      setReservations(data.data || [])
    } catch {
      toast.error('Rezervasyonlar yüklenemedi')
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { loadReservations() }, [loadReservations])

  const handleStatusChange = async (id: string, status: ReservationStatus) => {
    try {
      await reservationsApi.updateStatus(id, status)
      toast.success('Durum güncellendi')
      loadReservations()
    } catch {
      toast.error('Durum güncellenemedi')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await reservationsApi.delete(deleteId)
      toast.success('Rezervasyon silindi')
      setDeleteId(null)
      loadReservations()
    } catch {
      toast.error('Silinemedi')
    }
  }

  const handleRefund = async (id: string) => {
    try {
      await reservationsApi.refundDeposit(id)
      toast.success('Kapora iade edildi')
      loadReservations()
    } catch {
      toast.error('İade başarısız')
    }
  }

  const handleCodeSearch = async () => {
    const code = codeQuery.trim().toUpperCase()
    if (!code) {
      setCodeSearchResult(null)
      return
    }
    setCodeSearching(true)
    try {
      const { data } = await reservationsApi.getByCode(code)
      if (data.data) {
        setCodeSearchResult(data.data)
        // Bulunan rezervasyonun tarihine de geç
        if (data.data.date) {
          const [y, m, d] = data.data.date.split('-').map(Number)
          setSelectedDate(new Date(y, m - 1, d))
        }
      } else {
        setCodeSearchResult(null)
        toast.error('Bu kodla bir rezervasyon bulunamadı')
      }
    } catch {
      setCodeSearchResult(null)
      toast.error('Bu kodla bir rezervasyon bulunamadı')
    } finally {
      setCodeSearching(false)
    }
  }

  const clearCodeSearch = () => {
    setCodeQuery('')
    setCodeSearchResult(null)
  }

  // Calendar days
  const monthDays = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  })

  // Days that have reservations (just today's date-filtered, real app loads all)
  const todayFilteredRes = reservations.filter((r) => {
    const matches = statusFilter === 'all' || r.status === statusFilter
    return matches
  })

  const firstDayOfWeek = startOfMonth(calendarMonth).getDay()

  return (
    <div className="flex h-full">
      {/* LEFT: Mini Calendar */}
      <div className="w-72 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold font-display text-[var(--color-text)]">
              {format(calendarMonth, 'MMMM yyyy', { locale: tr })}
            </h2>
            <div className="flex gap-1">
              <button onClick={() => setCalendarMonth(m => addDays(startOfMonth(m), -1))}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setCalendarMonth(m => addDays(endOfMonth(m), 1))}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Pz','Pt','Sa','Ça','Pe','Cu','Ct'].map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-[var(--color-text-muted)] py-1 font-body">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: (firstDayOfWeek + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {monthDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate)
              const isCurrentDay = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'aspect-square flex items-center justify-center rounded-lg text-xs font-body font-medium transition-all duration-150',
                    isSelected
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)] shadow-glow-brand'
                      : isCurrentDay
                        ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick date nav */}
        <div className="p-3 space-y-1">
          {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
            const day = addDays(new Date(), offset)
            const isSelected = isSameDay(day, selectedDate)
            return (
              <button key={offset} onClick={() => setSelectedDate(day)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-xl text-xs font-body transition-colors',
                  isSelected
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] hover:text-[var(--color-text)]'
                )}>
                <span className="font-medium">
                  {offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın' : format(day, 'EEEE', { locale: tr })}
                </span>
                <span className="ml-2 opacity-60">{format(day, 'd MMM', { locale: tr })}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* RIGHT: Reservations list */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex-1">
            <h1 className="text-lg font-bold font-display text-[var(--color-text)]">
              {format(selectedDate, 'dd MMMM yyyy', { locale: tr })} Rezervasyonları
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] font-body">
              {todayFilteredRes.length} rezervasyon
            </p>
          </div>
          {/* Kod ile arama — müşteri restorana gelince personel kodu girer */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={codeQuery}
              onChange={(e) => setCodeQuery(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCodeSearch() }}
              placeholder="Kod ara (ör. EF7K2N)"
              className="w-44 pl-8 pr-8 py-2 bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl text-xs font-mono uppercase tracking-wider text-[var(--color-text)] placeholder-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-accent)]/50"
            />
            {codeQuery && (
              <button
                onClick={clearCodeSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                title="Aramayı temizle"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <Button size="sm" variant="secondary" loading={codeSearching} onClick={handleCodeSearch} disabled={!codeQuery.trim()}>
            Bul
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => { setEditReservation(undefined); setModalOpen(true) }}>
            Yeni Rezervasyon
          </Button>
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
          {(['all', 'confirmed', 'completed'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium font-body whitespace-nowrap transition-all duration-200 border',
                statusFilter === s
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                  : 'text-[var(--color-text-muted)] bg-transparent border-transparent hover:bg-[var(--color-surface2)]'
              )}>
              {s === 'all' ? 'Tümü' : STATUS_MAP[s].label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>
          ) : todayFilteredRes.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title="Rezervasyon yok"
              description="Bu tarihte rezervasyon bulunmuyor"
              action={
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
                  Rezervasyon Ekle
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {todayFilteredRes.sort((a, b) => a.time.localeCompare(b.time)).map((res) => (
                <div key={res.id}
                  className={cn(
                    'bg-[var(--color-surface)] border rounded-2xl p-4 hover:border-[var(--color-accent)]/20 transition-all duration-200 shadow-card',
                    codeSearchResult?.id === res.id
                      ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30'
                      : 'border-[var(--color-border)]'
                  )}>
                  <div className="flex items-start gap-3">
                    {/* Time badge */}
                    <div className="flex-shrink-0 text-center bg-[var(--color-surface2)] rounded-xl px-3 py-2 border border-[var(--color-border)]">
                      <p className="text-base font-bold font-mono text-[var(--color-accent)] leading-none">{res.time}</p>
                      {res.endTime && <p className="text-[10px] text-[var(--color-text-muted)] font-body mt-0.5">{res.endTime}</p>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {/* Rezervasyon Kodu — büyük, mono, vurgulu */}
                        {res.code && (
                          <span
                            title="Rezervasyon kodu"
                            className="font-mono font-bold text-sm tracking-[0.2em] text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded-lg select-all"
                          >
                            {res.code}
                          </span>
                        )}
                        <p className="font-semibold text-[var(--color-text)] font-body">
                          {res.tableName ? `📍 ${res.tableName}` : 'Genel'}
                        </p>
                        <Badge variant={STATUS_MAP[res.status].variant} dot>
                          {STATUS_MAP[res.status].label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] font-body flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users size={10} /> {res.guestCount} kişi
                        </span>
                        {!!res.deposit && (
                          <span className="flex items-center gap-1 text-amber-400">
                            <DollarSign size={10} />
                            {formatCurrency(res.deposit)} kapora
                            {res.depositPaid ? ' ✓' : ' (ödenmedi)'}
                          </span>
                        )}
                      </div>

                      {res.note && (
                        <p className="text-xs text-[var(--color-text-muted)] font-body mt-1.5 italic">"{res.note}"</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!!res.deposit && res.depositPaid && !res.depositRefunded && res.status === 'cancelled' && (
                        <button onClick={() => handleRefund(res.id)}
                          className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors text-xs font-body">
                          İade
                        </button>
                      )}
                      <button onClick={() => { setEditReservation(res); setModalOpen(true) }}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface2)] transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(res.id)}
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ReservationModal
        key={modalOpen ? (editReservation?.id ?? 'new') : 'closed'}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reservation={editReservation}
        onSuccess={loadReservations}
      />

      <ConfirmDialog
        isOpen={!!deleteId}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        title="Rezervasyonu Sil"
        message="Bu rezervasyonu silmek istediğinizden emin misiniz?"
        confirmText="Sil"
        danger
      />
    </div>
  )
}
