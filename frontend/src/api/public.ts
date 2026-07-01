import axios from 'axios'
import { CONFIG } from '@/config'

// Public (login'siz) QR menü/sipariş için auth-store'dan BAĞIMSIZ axios.
// Normal `client` token ekler ve 401'de oturumu temizler — public akışta istemeyiz.
const publicClient = axios.create({
  baseURL: `${CONFIG.API_BASE}/api/public`,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

export interface PublicMenuItem {
  id: string
  categoryId: string | null
  name: string
  description: string
  price: number
  hasImage: boolean
  imgVersion: number
  soldOut: boolean
  tags: string[]
}

export interface PublicMenu {
  restaurant: string
  paymentEnabled?: boolean
  categories: { id: string; name: string; icon: string; color: string }[]
  items: PublicMenuItem[]
}

export interface PublicOrderLine {
  menuItemId: string
  quantity: number
  note?: string
}

export const publicApi = {
  getMenu: (slug: string) =>
    publicClient.get<{ success: boolean; data: PublicMenu }>(`/${slug}/menu`),

  checkTable: (slug: string, number: number | string) =>
    publicClient.get<{ success: boolean; data: { number: number; name: string } }>(`/${slug}/tables/${number}`),

  createOrder: (slug: string, body: { tableNumber: number; items: PublicOrderLine[] }) =>
    publicClient.post<{ success: boolean; data: { orderId: string }; message?: string }>(`/${slug}/orders`, body),

  // Online ödeme başlat → iyzico hosted ödeme sayfası URL'i döner
  checkout: (slug: string, orderId: string) =>
    publicClient.post<{ success: boolean; data: { paymentPageUrl: string }; error?: string }>(`/${slug}/orders/${orderId}/checkout`, {}),

  // Ödeme dönüşünde GERÇEK durumu backend'den doğrula (query'deki ?paid=1'e güvenme)
  paymentStatus: (slug: string, orderId: string) =>
    publicClient.get<{ success: boolean; data: { paymentStatus: string; total: number } }>(`/${slug}/orders/${orderId}/payment-status`),
}
