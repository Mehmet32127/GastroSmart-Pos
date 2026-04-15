import React, { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { Download, TrendingUp, ShoppingBag, DollarSign, ArrowLeft } from 'lucide-react'
import { Card, Spinner } from '@/components/ui/common'
import { reportsApi } from '@/api/reports'
import { menuApi } from '@/api/menu'
import { formatCurrency } from '@/utils/format'
import toast from 'react-hot-toast'

const COLORS = ['#f59e0b','#22c55e','#3b82f6','#a78bfa','#ef4444','#ec4899','#14b8a6','#f97316','#64748b','#e11d48']

type Period = 'daily' | 'weekly'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'daily',  label: 'Günlük'   },
  { key: 'weekly', label: 'Haftalık' },
]

export const ReportsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('daily')
  const [daily, setDaily] = useState<any>(null)
  const [weekly, setWeekly] = useState<any[]>([])
  const [hourly, setHourly] = useState<any[]>([])
  const [waiters, setWaiters] = useState<any[]>([])
  const [exporting, setExporting] = useState<string | null>(null)

  const [categories, setCategories] = useState<any[]>([])
  const [categoryStats, setCategoryStats] = useState<{ id: string; name: string; icon: string; count: number; revenue: number }[]>([])
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [catItems, setCatItems] = useState<any[]>([])
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const [d, w, h, wa, ti, cats] = await Promise.all([
          reportsApi.getDailySummary(),
          reportsApi.getWeeklySummary(),
          reportsApi.getHourlySales(),
          reportsApi.getWaiterPerformance(),
          reportsApi.getTopItems({ limit: 100 }),
          menuApi.getCategories(),
        ])
        setDaily(d.data.data || null)
        setWeekly(w.data.data || [])
        setHourly(h.data.data || [])
        setWaiters(wa.data.data || [])

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
      const catIds = new Set(catMenuItems.map((m: any) => m.id))
      setCatItems(allItems.filter((i: any) => catIds.has(i.menuItemId)))
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

  const chartData = period === 'daily' ? hourly : weekly
  const chartKey = period === 'daily' ? 'revenue' : 'totalRevenue'
  const chartLabel = (v: any) => period === 'daily' ? `${v}:00` : String(v).slice(5, 10)

  const selectedCat = categories.find((c: any) => c.id === selectedCatId)

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

      {/* Özet kartlar */}
      {daily && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: <TrendingUp size={18}/>, label: 'Günlük Ciro', value: formatCurrency(daily.totalRevenue || 0), color: 'text-[var(--color-accent)]' },
            { icon: <ShoppingBag size={18}/>, label: 'Sipariş', value: String(daily.totalOrders || 0), color: 'text-blue-400' },
            { icon: <DollarSign size={18}/>, label: 'Nakit', value: formatCurrency(daily.cashRevenue || 0), color: 'text-green-400' },
            { icon: <DollarSign size={18}/>, label: 'Kart', value: formatCurrency(daily.cardRevenue || 0), color: 'text-purple-400' },
          ].map((s, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] font-body mb-1">{s.label}</p>
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                </div>
                <div className={`p-2 rounded-xl bg-[var(--color-surface2)] ${s.color}`}>{s.icon}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Ana içerik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Sol: Satış grafiği */}
        <Card className="lg:col-span-2" padding="md">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold font-display text-[var(--color-text)]">
              {period === 'daily' ? 'Saatlik Satış' : 'Satış Grafiği'}
            </h3>
            <div className="flex gap-1">
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

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
              <XAxis dataKey={period === 'daily' ? 'hour' : 'date'}
                tickFormatter={chartLabel}
                tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `₺${v}`}
                tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                axisLine={false} tickLine={false} width={48} />
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

          {/* Garson performansı */}
          {waiters.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
              <h4 className="text-xs font-semibold text-[var(--color-text-muted)] font-body mb-3">GARSON PERFORMANSI</h4>
              <div className="space-y-2.5">
                {waiters.slice(0, 4).map((w: any, i: number) => (
                  <div key={w.waiterId} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)] font-mono w-4">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium text-[var(--color-text)] font-body">{w.waiterName}</span>
                        <span className="text-xs font-mono text-[var(--color-accent)]">{formatCurrency(w.totalRevenue)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--color-surface2)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${waiters[0] ? (w.totalRevenue / waiters[0].totalRevenue) * 100 : 0}%`,
                          background: COLORS[i % COLORS.length]
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Sağ: Kategori pasta grafik */}
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
      </div>
    </div>
  )
}
