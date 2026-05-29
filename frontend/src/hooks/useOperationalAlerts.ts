import { useEffect, useState } from 'react'
import { ordersApi } from '@/api/orders'
import { tablesApi } from '@/api/tables'
import { reportsApi } from '@/api/reports'
import { useAuthStore } from '@/store/authStore'
import type { OperationalAlert } from '@/types'

const LATE_ORDER_MIN = 30   // sipariş bu kadar dk açıksa "geç"
const LONG_TABLE_MIN = 90   // masa bu kadar dk açıksa "uzun"

// "YYYY-MM-DD HH:MM" veya ISO → ms (bazı tarayıcılar boşluklu formatı NaN okur)
function toMs(s?: string): number {
  if (!s) return 0
  const t = new Date(s.includes('T') ? s : s.replace(' ', 'T')).getTime()
  return isNaN(t) ? 0 : t
}
const minsSince = (s?: string) => { const ms = toMs(s); return ms ? Math.floor((Date.now() - ms) / 60000) : 0 }

/**
 * Operasyonel uyarılar — eşik bazlı, canlı hesaplanır (60 sn'de bir):
 *  • Geciken siparişler (30 dk+ açık)
 *  • Uzun süre açık masalar (90 dk+)
 *  • Düşük stok (yalnız admin/müdür — rapor yetkisi olanlar)
 *
 * Garson rapor/uyarı görmez. Her hesaplamada liste TAMAMEN yenilenir (replace),
 * böylece çözülen uyarılar kendiliğinden düşer; tekrar/birikme olmaz.
 */
export function useOperationalAlerts(): OperationalAlert[] {
  const { user } = useAuthStore()
  const [alerts, setAlerts] = useState<OperationalAlert[]>([])
  const role = user?.role
  const canSee = role === 'admin' || role === 'manager' || role === 'cashier'

  useEffect(() => {
    if (!canSee) { setAlerts([]); return }
    let active = true

    const compute = async () => {
      try {
        const [ordRes, tblRes] = await Promise.all([
          ordersApi.getAll({ status: 'open' }),
          tablesApi.getAll(),
        ])
        const list: OperationalAlert[] = []

        const orders = (ordRes.data.data || []) as Array<{ createdAt?: string }>
        const lateCount = orders.filter(o => minsSince(o.createdAt) >= LATE_ORDER_MIN).length
        if (lateCount > 0) {
          list.push({
            id: 'late-orders',
            severity: 'danger',
            title: `${lateCount} geciken sipariş`,
            message: `${LATE_ORDER_MIN} dk+ açık sipariş var — ilgilenilmeli.`,
          })
        }

        const tables = (tblRes.data.data || []) as Array<{ status: string; openedAt?: string; name: string }>
        const longTables = tables.filter(t => t.status === 'occupied' && minsSince(t.openedAt) >= LONG_TABLE_MIN)
        if (longTables.length > 0) {
          list.push({
            id: 'long-tables',
            severity: 'warning',
            title: `${longTables.length} masa uzun süredir açık`,
            message: longTables.slice(0, 3).map(t => t.name).join(', ') + (longTables.length > 3 ? '…' : ''),
          })
        }

        // Düşük stok — rapor yetkisi gerektirir (kasiyer overview göremez)
        if (role === 'admin' || role === 'manager') {
          try {
            const ov = await reportsApi.getOverview()
            const low = ov.data.data?.lowStock || []
            if (low.length > 0) {
              list.push({
                id: 'low-stock',
                severity: 'warning',
                title: `${low.length} üründe stok düşük`,
                message: low.slice(0, 3).map(i => i.name).join(', ') + (low.length > 3 ? '…' : ''),
              })
            }
          } catch { /* yetki/ağ hatası — stok uyarısını atla */ }
        }

        if (active) setAlerts(list)
      } catch { /* ağ hatası — uyarıları koru, sessiz geç */ }
    }

    compute()
    const iv = setInterval(compute, 60000)
    return () => { active = false; clearInterval(iv) }
  }, [canSee, role])

  return alerts
}
