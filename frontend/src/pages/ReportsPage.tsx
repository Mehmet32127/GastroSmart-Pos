import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { Download, TrendingUp, ShoppingBag, DollarSign, ArrowLeft, Crown, Receipt, Users, Package, Clock, Ban, Flame, LayoutGrid, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, Spinner } from '@/components/ui/common'
import { reportsApi } from '@/api/reports'
import { menuApi } from '@/api/menu'
import { formatCurrency } from '@/utils/format'
import type { WaiterPerformance, ReportsOverview, TableStats, LowStockItem } from '@/types'
import toast from 'react-hot-toast'

const COLORS = ['#f59e0b','#22c55e','#3b82f6','#a78bfa','#ef4444','#ec4899','#14b8a6','#f97316','#64748b','#e11d48']

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily',   label: 'Günlük'   },
  { key: 'weekly',  label: 'Haftalık' },
  { key: 'monthly', label: 'Aylık'    },
  { key: 'yearly',  label: 'Yıllık'   },
]

const MONTH_NAMES = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']

// Dakikayı okunur süreye çevir: 45 → "45dk", 870 → "14s 30dk"
function fmtDuration(min: number): string {
  const m = Math.round(min || 0)
  if (m <= 0) return '—'
  if (m < 60) return `${m}dk`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}s ${r}dk` : `${h}s`
}

// Garson kartındaki tek metrik rozeti
const WaiterStat: React.FC<{
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  danger?: boolean
}> = ({ icon, value, label, danger }) => (
  <span
    title={label}
    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--color-surface2)] text-[10px] font-mono whitespace-nowrap ${
      danger ? 'text-red-500 font-semibold' : 'text-[var(--color-text-muted)]'
    }`}
  >
    <span className="opacity-70 shrink-0">{icon}</span>
    {value}
  </span>
)

// KPI kartı — opsiyonel "dün'e göre %% değişim" trend oku ile
const KpiCard: React.FC<{
  icon: React.ReactNode
  label: string
  value: string
  color: string
  trend?: number | null
}> = ({ icon, label, value, color, trend }) => (
  <Card>
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-text-muted)] font-body mb-1 truncate">{label}</p>
        <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
        {trend != null && isFinite(trend) && (
          <p className={`text-[10px] font-mono mt-1 flex items-center gap-0.5 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            %{Math.abs(trend).toFixed(0)}
            <span className="text-[var(--color-text-muted)]">dün</span>
          </p>
        )}
      </div>
      <div className={`p-2 rounded-xl bg-[var(--color-surface2)] ${color} shrink-0`}>{icon}</div>
    </div>
  </Card>
)

// En çok satan ürünler — yatay bar listesi
const TopItemsWidget: React.FC<{ items: { name: string; count: number; revenue: number }[] }> = ({ items }) => {
  const max = items[0]?.count || 1
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3 flex items-center gap-2">
        <Flame size={15} className="text-[var(--color-accent)]" /> En Çok Satanlar
      </h3>
      {items.length > 0 ? (
        <div className="space-y-2.5">
          {items.slice(0, 8).map((it, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1 text-xs gap-2">
                <span className="text-[var(--color-text)] font-body truncate">{i + 1}. {it.name}</span>
                <span className="font-mono text-[var(--color-text-muted)] shrink-0 whitespace-nowrap">
                  {it.count} adet · <span className="text-[var(--color-accent)]">{formatCurrency(it.revenue)}</span>
                </span>
              </div>
              <div className="h-1.5 bg-[var(--color-surface2)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: COLORS[i % COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-10 font-body">Satış verisi yok</p>
      )}
    </Card>
  )
}

// Ödeme dağılımı satırı
const PayRow: React.FC<{ color: string; label: string; value: number; pct: number }> = ({ color, label, value, pct }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
    <span className="text-[var(--color-text)] font-body flex-1">{label}</span>
    <span className="font-mono text-[var(--color-text-muted)]">%{pct.toFixed(0)}</span>
    <span className="font-mono text-[var(--color-accent)] w-24 text-right">{formatCurrency(value)}</span>
  </div>
)

// Ödeme dağılımı — nakit/kart donut
const PaymentDonut: React.FC<{ cash: number; card: number }> = ({ cash, card }) => {
  const total = cash + card
  const data = [{ name: 'Nakit', value: cash }, { name: 'Kart', value: card }].filter(d => d.value > 0)
  const cols = ['#22c55e', '#a78bfa']
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3 flex items-center gap-2">
        <DollarSign size={15} className="text-[var(--color-accent)]" /> Ödeme Dağılımı
      </h3>
      {total > 0 ? (
        <>
          <div className="flex justify-center my-2">
            <PieChart width={160} height={160}>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} isAnimationActive={false}>
                {data.map((_, i) => <Cell key={i} fill={cols[i]} stroke="none" />)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2 mt-2">
            <PayRow color={cols[0]} label="Nakit" value={cash} pct={(cash / total) * 100} />
            <PayRow color={cols[1]} label="Kart" value={card} pct={(card / total) * 100} />
          </div>
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-10 font-body">Ödeme verisi yok</p>
      )}
    </Card>
  )
}

// Masa doluluk halkası + bugünkü devir
const TablesWidget: React.FC<{ tables: TableStats; turnover: number; closedToday: number }> = ({ tables, turnover, closedToday }) => {
  const segs = [
    { label: 'Dolu', value: tables.occupied, color: '#ef4444' },
    { label: 'Boş', value: tables.available, color: '#22c55e' },
    { label: 'Rezerve', value: tables.reserved, color: '#f59e0b' },
    { label: 'Temizlik', value: tables.cleaning, color: '#3b82f6' },
  ]
  const pie = segs.filter(s => s.value > 0)
  return (
    <Card padding="md">
      <h3 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3 flex items-center gap-2">
        <LayoutGrid size={15} className="text-[var(--color-accent)]" /> Masa Doluluk & Devir
      </h3>
      <div className="flex items-center gap-4">
        <div className="relative w-[120px] h-[120px] shrink-0">
          {tables.total > 0 ? (
            <PieChart width={120} height={120}>
              <Pie data={pie} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={56} paddingAngle={2} isAnimationActive={false}>
                {pie.map((s, i) => <Cell key={i} fill={s.color} stroke="none" />)}
              </Pie>
            </PieChart>
          ) : null}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold font-mono text-[var(--color-text)]">%{tables.occupancyRate.toFixed(0)}</span>
            <span className="text-[9px] text-[var(--color-text-muted)] font-body">doluluk</span>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {segs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[var(--color-text)] font-body flex-1">{s.label}</span>
              <span className="font-mono text-[var(--color-text-muted)]">{s.value}</span>
            </div>
          ))}
          <div className="pt-1.5 mt-1 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)] font-body">Bugün devir</span>
            <span className="font-mono text-[var(--color-accent)] font-bold">
              {turnover.toFixed(1)}x <span className="text-[var(--color-text-muted)] font-normal">({closedToday})</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Düşük stok uyarıları
const LowStockWidget: React.FC<{ items: LowStockItem[] }> = ({ items }) => (
  <Card padding="md">
    <h3 className="text-sm font-semibold font-display text-[var(--color-text)] mb-3 flex items-center gap-2">
      <AlertTriangle size={15} className="text-amber-400" /> Düşük Stok Uyarıları
      {items.length > 0 && <span className="ml-auto text-xs font-mono text-amber-400">{items.length}</span>}
    </h3>
    {items.length > 0 ? (
      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {items.map((it, i) => {
          const out = it.stock_quantity <= 0
          return (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)]/40">
              <span className="text-xs text-[var(--color-text)] font-body truncate pr-2">{it.name}</span>
              <span className={`text-xs font-mono shrink-0 ${out ? 'text-red-500 font-semibold' : 'text-amber-400'}`}>
                {out ? 'TÜKENDİ' : `${it.stock_quantity} ${it.unit}`}
                <span className="text-[var(--color-text-muted)] font-normal"> / min {it.min_stock}</span>
              </span>
            </div>
          )
        })}
      </div>
    ) : (
      <p className="text-sm text-[var(--color-text-muted)] text-center py-10 font-body">✓ Tüm stoklar yeterli</p>
    )}
  </Card>
)

export const ReportsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('daily')
  const [daily, setDaily] = useState<any>(null)
  const [weekly, setWeekly] = useState<any[]>([])
  const [hourly, setHourly] = useState<any[]>([])
  const [waiters, setWaiters] = useState<any[]>([])
  const [overview, setOverview] = useState<ReportsOverview | null>(null)
  const [yesterday, setYesterday] = useState<any>(null)
  const [topItems, setTopItems] = useState<{ name: string; count: number; revenue: number }[]>([])
  const [exporting, setExporting] = useState<string | null>(null)

  // Monthly / yearly picker state
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1 // 1-12
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [monthlyRows, setMonthlyRows] = useState<any[]>([])
  const [yearlyRows, setYearlyRows] = useState<any[]>([])
  const [subLoading, setSubLoading] = useState(false)

  const [categories, setCategories] = useState<any[]>([])
  const [categoryStats, setCategoryStats] = useState<{ id: string; name: string; icon: string; count: number; revenue: number }[]>([])
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [catItems, setCatItems] = useState<any[]>([])
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const yStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const [d, w, h, wa, ti, cats, ov, yd] = await Promise.all([
          reportsApi.getDailySummary(),
          reportsApi.getWeeklySummary(),
          reportsApi.getHourlySales(),
          reportsApi.getWaiterPerformance(),
          reportsApi.getTopItems({ limit: 100 }),
          menuApi.getCategories(),
          reportsApi.getOverview(),
          reportsApi.getDailySummary(yStr),
        ])
        setDaily(d.data.data || null)
        setWeekly(w.data.data || [])
        setHourly(h.data.data || [])
        setWaiters(wa.data.data || [])
        setOverview(ov.data.data || null)
        setYesterday(yd.data.data || null)
        setTopItems((ti.data.data as any[]) || [])

        const catList: any[] = cats.data.data || []
        setCategories(catList)

        // Top items → kategori bazında grupla
        const items: any[] = ti.data.data || []
        // Tüm menü ürünlerini çek (categoryId eşlemesi için)
        const allMenuRes = await menuApi.getItems({ active: true })
        const allMenu: any[] = allMenuRes.data.data || []
        const idToCategory: Record<string, string> = {}
        allMenu.forEach((m: any) => { idToCategory[m.id] = m.categoryId })

        const catMap: Record<string, { id: string; name: string; icon: string; count: number; revenue: number }> = {}
        catList.forEach((c: any) => { catMap[c.id] = { id: c.id, name: c.name, icon: c.icon || '', count: 0, revenue: 0 } })
        items.forEach((item: any) => {
          const catId = idToCategory[item.id] ?? null
          if (catId && catMap[catId]) {
            catMap[catId].count += item.count || 0
            catMap[catId].revenue += item.revenue || 0
          }
        })
        setCategoryStats(Object.values(catMap).filter(c => c.count > 0))
      } catch {
        toast.error('Raporlar yüklenemedi')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  // Load monthly data (daily breakdown of a specific month)
  useEffect(() => {
    if (period !== 'monthly') return
    const load = async () => {
      setSubLoading(true)
      try {
        const mm = String(selectedMonth).padStart(2, '0')
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
        const startDate = `${selectedYear}-${mm}-01`
        const endDate   = `${selectedYear}-${mm}-${String(daysInMonth).padStart(2, '0')}`
        const { data } = await reportsApi.getWeeklySummaryRange(startDate, endDate)
        setMonthlyRows(data.data || [])
      } catch { toast.error('Aylık rapor yüklenemedi') }
      finally { setSubLoading(false) }
    }
    load()
  }, [period, selectedYear, selectedMonth])

  // Load yearly data (monthly breakdown of a specific year)
  useEffect(() => {
    if (period !== 'yearly') return
    const load = async () => {
      setSubLoading(true)
      try {
        const { data } = await reportsApi.getMonthlySummary(selectedYear)
        setYearlyRows(data.data?.rows || [])
      } catch { toast.error('Yıllık rapor yüklenemedi') }
      finally { setSubLoading(false) }
    }
    load()
  }, [period, selectedYear])

  const handleCatClick = async (catId: string) => {
    if (selectedCatId === catId) { setSelectedCatId(null); setCatItems([]); return }
    setSelectedCatId(catId)
    try {
      const [ti, catMenuRes] = await Promise.all([
        reportsApi.getTopItems({ limit: 100 }),
        menuApi.getItems({ categoryId: catId }),
      ])
      const allItems: any[] = ti.data.data || []
      const catMenuItems: any[] = catMenuRes.data.data || []
      const catIds = new Set(catMenuItems.map((m: any) => String(m.id)))
      setCatItems(allItems.filter((i: any) => catIds.has(String(i.id))))
    } catch { toast.error('Kategori yüklenemedi') }
  }

  const handleExport = async (type: 'daily' | 'weekly' | 'waiters' | 'stock') => {
    setExporting(type)
    try {
      const { data } = await reportsApi.exportExcel(type)
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gastrosmart-${type}-${new Date().toISOString().split('T')[0]}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel indirildi')
    } catch { toast.error('Export başarısız') }
    finally { setExporting(null) }
  }

  const chartData = period === 'daily' ? hourly : period === 'weekly' ? weekly : period === 'monthly' ? monthlyRows : yearlyRows
  const chartKey = period === 'daily' ? 'revenue' : 'totalRevenue'
  const chartXKey = period === 'daily' ? 'hour' : period === 'yearly' ? 'month' : 'date'
  const chartLabel = (v: any) => {
    if (period === 'daily') return `${v}:00`
    if (period === 'weekly' || period === 'monthly') return String(v).slice(5, 10)
    // yearly: 'YYYY-MM' → month name
    const monthIdx = parseInt(String(v).slice(5, 7)) - 1
    return MONTH_NAMES[monthIdx] ?? String(v)
  }

  const selectedCat = categories.find((c: any) => c.id === selectedCatId)

  // KPI yardımcıları: dün'e göre trend + günün en yoğun saati
  const pct = (now: number, prev: number) => (prev > 0 ? ((now - prev) / prev) * 100 : null)
  const revTrend = daily && yesterday ? pct(daily.totalRevenue || 0, yesterday.totalRevenue || 0) : null
  const ordTrend = daily && yesterday ? pct(daily.totalOrders || 0, yesterday.totalOrders || 0) : null
  const peakHour = hourly.length ? hourly.reduce((a: any, b: any) => (b.revenue > a.revenue ? b : a), hourly[0]) : null
  const peakLabel = peakHour && peakHour.revenue > 0 ? `${peakHour.hour}:00` : '—'

  if (isLoading) return <div className="flex items-center justify-center h-full"><Spinner size={40} /></div>

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold font-display text-[var(--color-text)]">Raporlar</h1>
          <p className="text-sm text-[var(--color-text-muted)] font-body">Satış analizi ve istatistikler</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['daily','weekly','waiters','stock'] as const).map(type => (
            <button key={type} onClick={() => handleExport(type)} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-surface2)] border border-[var(--color-border)] text-xs font-body text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50">
              <Download size={12} />
              {type === 'daily' ? 'Günlük' : type === 'weekly' ? 'Haftalık' : type === 'waiters' ? 'Garsonlar' : 'Stok'}
            </button>
          ))}
        </div>
      </div>

      {/* Özet kartlar (6) — ciro & sipariş kartlarında dün'e göre trend */}
      {daily && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={<TrendingUp size={18} />} label="Günlük Ciro" value={formatCurrency(daily.totalRevenue || 0)} color="text-[var(--color-accent)]" trend={revTrend} />
          <KpiCard icon={<ShoppingBag size={18} />} label="Sipariş" value={String(daily.totalOrders || 0)} color="text-blue-400" trend={ordTrend} />
          <KpiCard icon={<Receipt size={18} />} label="Ort. Adisyon" value={formatCurrency(daily.averageOrderValue || 0)} color="text-cyan-400" />
          <KpiCard icon={<DollarSign size={18} />} label="Nakit" value={formatCurrency(daily.cashRevenue || 0)} color="text-green-400" />
          <KpiCard icon={<DollarSign size={18} />} label="Kart" value={formatCurrency(daily.cardRevenue || 0)} color="text-purple-400" />
          <KpiCard icon={<Clock size={18} />} label="En Yoğun Saat" value={peakLabel} color="text-amber-400" />
        </div>
      )}

      {/* Satış grafiği — full width */}
      <Card padding="md">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold font-display text-[var(--color-text)]">
              {period === 'daily' ? 'Saatlik Satış' : period === 'weekly' ? 'Haftalık Satış' : period === 'monthly' ? 'Aylık Satış' : 'Yıllık Satış'}
            </h3>
            <div className="flex gap-1 flex-wrap">
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-body transition-colors ${
                    period === p.key
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-text)]'
                      : 'bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly picker */}
          {period === 'monthly' && (
            <div className="flex items-center gap-2 mb-3">
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs font-body text-[var(--color-text)] focus:outline-none">
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs font-body text-[var(--color-text)] focus:outline-none">
                {MONTH_NAMES.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Yearly picker */}
          {period === 'yearly' && (
            <div className="flex items-center gap-2 mb-3">
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-[var(--color-surface2)] border border-[var(--color-border)] rounded-xl px-3 py-1.5 text-xs font-body text-[var(--color-text)] focus:outline-none">
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {subLoading ? (
            <div className="flex items-center justify-center h-[220px]"><Spinner size={32} /></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <XAxis dataKey={chartXKey}
                  tickFormatter={chartLabel}
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v: number) => formatCurrency(v).replace(/[₺$€£]/, v >= 1000 ? (v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}K`) : String(v))}
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 4 }}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '6px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                        <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>{chartLabel(label)}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace' }}>{formatCurrency(payload[0]?.value)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey={chartKey} fill="var(--color-accent)" radius={[4,4,0,0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Aylık özet tablo */}
          {period === 'monthly' && !subLoading && monthlyRows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] font-body mb-2">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear} — GÜNLÜK ÖZET
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {monthlyRows.map((r: any) => (
                  <div key={r.date} className="flex items-center justify-between text-xs py-1 border-b border-[var(--color-border)]/30">
                    <span className="text-[var(--color-text-muted)] font-mono">{String(r.date).slice(5, 10)}</span>
                    <span className="text-[var(--color-text)] font-mono">{r.totalOrders} sipariş</span>
                    <span className="text-[var(--color-accent)] font-mono font-bold">{formatCurrency(r.totalRevenue)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs pt-2 font-bold">
                <span className="text-[var(--color-text-muted)] font-body">Toplam</span>
                <span className="text-[var(--color-text)] font-mono">{monthlyRows.reduce((s: number, r: any) => s + r.totalOrders, 0)} sipariş</span>
                <span className="text-[var(--color-accent)] font-mono">{formatCurrency(monthlyRows.reduce((s: number, r: any) => s + r.totalRevenue, 0))}</span>
              </div>
            </div>
          )}

          {/* Yıllık özet tablo */}
          {period === 'yearly' && !subLoading && yearlyRows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] font-body mb-2">
                {selectedYear} — AYLIK ÖZET
              </h4>
              <div className="space-y-1">
                {yearlyRows.map((r: any) => {
                  const mIdx = parseInt(String(r.month).slice(5, 7)) - 1
                  return (
                    <div key={r.month} className="flex items-center justify-between text-xs py-1 border-b border-[var(--color-border)]/30">
                      <span className="text-[var(--color-text-muted)] font-body w-8">{MONTH_NAMES[mIdx]}</span>
                      <span className="text-[var(--color-text)] font-mono">{r.totalOrders} sipariş</span>
                      <span className="text-[var(--color-text-muted)] font-mono">{formatCurrency(r.averageOrderValue)} ort.</span>
                      <span className="text-[var(--color-accent)] font-mono font-bold">{formatCurrency(r.totalRevenue)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs pt-2 font-bold">
                <span className="text-[var(--color-text-muted)] font-body">Toplam</span>
                <span className="text-[var(--color-text)] font-mono">{yearlyRows.reduce((s: number, r: any) => s + r.totalOrders, 0)} sipariş</span>
                <span className="text-[var(--color-accent)] font-mono">{formatCurrency(yearlyRows.reduce((s: number, r: any) => s + r.totalRevenue, 0))}</span>
              </div>
            </div>
          )}

        </Card>

      {/* 3'lü grid: Kategori dağılımı | En çok satanlar | Ödeme dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Kategori pasta grafik (boyut sabit) */}
        <Card padding="md">
          <div className="flex items-center gap-2 mb-3">
            {selectedCatId && (
              <button onClick={() => { setSelectedCatId(null); setCatItems([]) }}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface2)] transition-colors">
                <ArrowLeft size={14} />
              </button>
            )}
            <h3 className="text-sm font-semibold font-display text-[var(--color-text)]">
              {selectedCatId ? `${selectedCat?.icon || ''} ${selectedCat?.name || ''}` : 'Kategori Dağılımı'}
            </h3>
          </div>

          {!selectedCatId ? (
            categoryStats.length > 0 ? (
              <>
                {/* Pasta grafik — tooltip yok, ortalanmış */}
                <div className="flex justify-center my-2">
                  <PieChart width={180} height={180}>
                    <Pie
                      data={categoryStats} dataKey="count" nameKey="name"
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={2} isAnimationActive={false}
                      onMouseEnter={(_: any, idx: number) => setActiveIdx(idx)}
                      onMouseLeave={() => setActiveIdx(null)}
                      onClick={(data: any) => handleCatClick(data.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {categoryStats.map((cat, i) => (
                        <Cell key={cat.id} fill={COLORS[i % COLORS.length]}
                          opacity={activeIdx === null || activeIdx === i ? 1 : 0.5}
                          stroke="none" />
                      ))}
                    </Pie>
                  </PieChart>
                </div>

                {/* Kategori listesi */}
                <div className="space-y-1">
                  {categoryStats.map((cat, i) => (
                    <button key={cat.id} onClick={() => handleCatClick(cat.id)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-[var(--color-surface2)] transition-colors">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-[var(--color-text)] font-body flex-1 text-left truncate">{cat.icon} {cat.name}</span>
                      <span className="text-xs font-mono text-[var(--color-text-muted)]">{cat.count}</span>
                      <span className="text-xs font-mono text-[var(--color-accent)]">{formatCurrency(cat.revenue)}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-12 font-body">Satış verisi yok</p>
            )
          ) : (
            catItems.length > 0 ? (
              <div className="space-y-1.5">
                {catItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-[var(--color-border)]/40">
                    <span className="text-xs text-[var(--color-text)] font-body flex-1 truncate pr-2">{item.name}</span>
                    <span className="text-xs font-mono text-[var(--color-text-muted)] mr-2">{item.count}</span>
                    <span className="text-xs font-mono text-[var(--color-accent)]">{formatCurrency(item.revenue)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-12 font-body">Bu kategoride satış yok</p>
            )
          )}
        </Card>

        <TopItemsWidget items={topItems} />
        <PaymentDonut cash={daily?.cashRevenue || 0} card={daily?.cardRevenue || 0} />
      </div>

      {/* 2'li grid: Masa doluluk | Düşük stok */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <TablesWidget tables={overview.tables} turnover={overview.turnover} closedToday={overview.closedToday} />
          <LowStockWidget items={overview.lowStock} />
        </div>
      )}

      {/* Garson performansı — full width */}
      {waiters.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold font-display text-[var(--color-text)] mb-4 flex items-center gap-2">
            <Crown size={16} className="text-amber-400" fill="currentColor" /> Garson Performansı
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            {(waiters as WaiterPerformance[]).slice(0, 6).map((w, i) => {
              const topRevenue = (waiters[0] as WaiterPerformance)?.totalRevenue || 0
              const share = topRevenue ? (w.totalRevenue / topRevenue) * 100 : 0
              return (
                <div key={w.waiterId}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="w-5 flex items-center justify-center shrink-0">
                      {i === 0 ? (
                        <Crown size={15} className="text-amber-400" fill="currentColor" />
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)] font-mono">{i + 1}</span>
                      )}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-[var(--color-text)] font-body truncate">
                      {w.waiterName || '—'}
                    </span>
                    <span className="text-sm font-mono font-bold text-[var(--color-accent)]">
                      {formatCurrency(w.totalRevenue)}
                    </span>
                  </div>

                  <div className="h-1.5 bg-[var(--color-surface2)] rounded-full overflow-hidden ml-7">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${share}%`,
                      background: COLORS[i % COLORS.length],
                    }} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                    <WaiterStat icon={<Receipt size={11} />} value={w.totalOrders} label="Sipariş sayısı" />
                    <WaiterStat icon={<Users size={11} />} value={w.totalGuests} label="Toplam misafir" />
                    <WaiterStat icon={<Package size={11} />} value={w.itemsSold} label="Satılan ürün adedi" />
                    <WaiterStat icon={<DollarSign size={11} />} value={formatCurrency(w.averageOrderValue)} label="Ortalama adisyon" />
                    <WaiterStat icon={<Users size={11} />} value={`${formatCurrency(w.revenuePerGuest)}/kişi`} label="Kişi başı ciro" />
                    <WaiterStat icon={<Clock size={11} />} value={fmtDuration(w.avgServiceTime)} label="Ortalama servis süresi" />
                    <WaiterStat icon={<Ban size={11} />} value={`%${(w.cancelRate ?? 0).toFixed(1)}`} label="İptal oranı" danger={w.cancelRate > 10} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
